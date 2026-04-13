import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
let totalUpdates = 0;

async function bulkReplace(
  field: string,
  from: string,
  to: string,
  label: string
) {
  const query = `UPDATE repair_jobs SET ${field} = REPLACE(${field}, $1, $2) WHERE ${field} LIKE $3 RETURNING id`;
  const result = await sql.query(query, [from, to, `%${from}%`]);
  if (result.length > 0) {
    console.log(`  ✓ ${label}: ${result.length}× ${field}`);
    totalUpdates += result.length;
  }
}

async function bulkRegex(
  field: string,
  pattern: string,
  replacement: string,
  label: string
) {
  const query = `UPDATE repair_jobs SET ${field} = regexp_replace(${field}, $1, $2, 'g') WHERE ${field} ~ $1 RETURNING id`;
  const result = await sql.query(query, [pattern, replacement]);
  if (result.length > 0) {
    console.log(`  ✓ ${label}: ${result.length}× ${field}`);
    totalUpdates += result.length;
  }
}

async function main() {
  console.log("=== Repair Text Cleanup ===\n");

  const fields = ["title", "description_raw"];

  // ── PHASE 1: Spelling & Grammar ──────────────────────────────
  console.log("Phase 1: Spelling & grammar...");

  // Order matters: "doesnt not" before "doesnt"
  const spelling: [string, string][] = [
    ["doesnt not", "doesn't"],
    [" arent ", " aren't "],
    [" doesnt ", " doesn't "],
    ["handbreak", "handbrake"],
    ["reparing", "repairing"],
    ["loosing", "losing"],
    ["unware", "unaware"],
    ["Severall", "Several"],
    ["chimeney", "chimney"],
  ];

  for (const field of fields) {
    for (const [from, to] of spelling) {
      await bulkReplace(field, from, to, `${from} → ${to}`);
    }
  }

  // ── PHASE 2: Spacing & Punctuation ───────────────────────────
  console.log("\nPhase 2: Spacing & punctuation...");

  for (const field of fields) {
    // Space before comma: " ," → ","
    await bulkReplace(field, " ,", ",", "space before comma");

    // Add space after comma when missing: "damper,beading" → "damper, beading"
    await bulkRegex(field, ",([a-zA-Z])", ", \\1", "missing space after comma");

    // Multiple rounds to collapse double/triple spaces
    for (let i = 0; i < 3; i++) {
      await bulkReplace(field, "  ", " ", "double space");
    }

    // Trim leading/trailing whitespace
    const trimQ = `UPDATE repair_jobs SET ${field} = TRIM(${field}) WHERE ${field} IS NOT NULL AND ${field} != TRIM(${field}) RETURNING id`;
    const trimR = await sql.query(trimQ);
    if (trimR.length > 0) {
      console.log(`  ✓ Trimmed whitespace: ${trimR.length}× ${field}`);
      totalUpdates += trimR.length;
    }

    // Remove trailing commas, dashes, dots+commas
    await bulkRegex(field, "[,\\-\\.\\s]+$", "", "trailing punctuation");
  }

  // ── PHASE 3: Capitalize First Letter ─────────────────────────
  console.log("\nPhase 3: Capitalizing first letters...");

  for (const field of fields) {
    const capQ = `UPDATE repair_jobs SET ${field} = UPPER(LEFT(${field}, 1)) || SUBSTRING(${field} FROM 2) WHERE ${field} IS NOT NULL AND LENGTH(${field}) > 0 AND LEFT(${field}, 1) ~ '[a-z]' RETURNING id`;
    const capR = await sql.query(capQ);
    if (capR.length > 0) {
      console.log(`  ✓ Capitalized: ${capR.length}× ${field}`);
      totalUpdates += capR.length;
    }
  }

  // ── PHASE 4: Clean notes_raw "true"/"false" ──────────────────
  console.log("\nPhase 4: Clean notes_raw boolean values...");

  const notesR =
    await sql`UPDATE repair_jobs SET notes_raw = NULL WHERE notes_raw IN ('true', 'false') RETURNING id`;
  if (notesR.length > 0) {
    console.log(`  ✓ Cleared boolean notes_raw: ${notesR.length} records`);
    totalUpdates += notesR.length;
  }

  // ── PHASE 5: Individual Record Fixes ─────────────────────────
  console.log("\nPhase 5: Individual fixes...");

  const fixes: {
    id: string;
    title: string;
    desc?: string;
  }[] = [
    // "le feber is old owne tyres..." → fix garbled text + "owne" → "owner"
    {
      id: "5148f1c7-54d4-4370-84a2-c286aa1b6278",
      title:
        "Le Feber is old owner. Tyres from 2010 (5.00-10 - 1710)",
      desc: "Rear left light broken, rear lights aren't working.\n\nLe Feber is old owner. Tyres from 2010 (5.00-10 - 1710), rear left light broken, rear lights aren't working.",
    },
    // "gas chimney lid broken but its one..." → clarity + "its" → "it's"
    {
      id: "818bea67-f052-435d-ab99-e0ea4fe93ffb",
      title:
        "Gas chimney lid broken, it's connected to the whole chimney",
      desc: "Would need to change the whole chimney but it's not badly broken.\n\nGas chimney lid broken, it's connected to the whole chimney. Would need to change the whole chimney but it's not badly broken.",
    },
    // ALL CAPS → proper case
    {
      id: "a28baa14-cfd1-4d84-ae0b-0125b258e486",
      title:
        "HV-716-X - CSS trailer - Customer paid €100 to get rid of trailer",
      desc: "HV-716-X - CSS trailer - Customer paid €100 to get rid of trailer",
    },
    // "WILDEMAN is ex owner" → fix caps + hyphenate
    {
      id: "4e92ea67-6b73-45ed-8d0c-e1cfdf0d2ae5",
      title:
        "Wildeman is ex-owner. Needs new tyres 145R10 (no date on wheels)",
      desc: "Rear left light broken.\n\nWildeman is ex-owner. Needs new tyres 145R10 (no date on wheels), rear left light broken.",
    },
    // "draw handle" → "drawer handle", "TOILET" → "toilet"
    {
      id: "4792f82b-0529-49d4-8f46-c9444c991665",
      title:
        "No exterior damage. Replace drawer handle underneath sink + toilet",
      desc: "No exterior damage. Replace drawer handle underneath sink + toilet",
    },
    // "Called and emailed NO REPLY rear lights..." → restructure
    {
      id: "4abf5996-de1c-4121-8525-af189cf83ede",
      title: "Rear lights need repairing (called and emailed, no reply)",
      desc: "Rear lights need repairing (called and emailed, no reply)",
    },
    // "called and emailed - NO REPLY tyres from 2012..." → restructure
    {
      id: "623a8ede-f1ec-4a91-8e87-a3c2a175552d",
      title:
        "Tyres from 2012 (135R13 - 2412) — called and emailed, no reply",
      desc: "Tyres from 2012 (135R13 - 2412) — called and emailed, no reply",
    },
    // "x1 40x40 rooflight broken, FRONT BOX DAMPER., already invoiced" → fix caps
    {
      id: "9f4922b7-456d-49fc-b9d1-7b938072a9e2",
      title:
        "1x 40x40 rooflight broken, front box damper (already invoiced)",
      desc: "1x 40x40 rooflight broken, front box damper (already invoiced)",
    },
    // "client sent email with word document attached..." → cleaner
    {
      id: "a836ac09-44ab-48c8-9414-057dd241ea4a",
      title: "Client sent email with photos and details (1/9/25)",
      desc: "Client sent email with photos and details (1/9/25)",
    },
    // "roan css trailer" → capitalize
    {
      id: "bc88ed5a-dec1-4bf9-afeb-db009871967e",
      title: "Roan CSS trailer",
    },
    // "No damage, rear lights arent working - rejected clients will collect"
    {
      id: "1ba89cf2-23bf-41a3-94db-01bb0347ac68",
      title:
        "No damage, rear lights aren't working — rejected, clients will collect trailer",
      desc: "No damage, rear lights aren't working — rejected, clients will collect trailer themselves.",
    },
    // "few repairs we need to do from previous years" → clearer title
    {
      id: "8fd2e24f-e0c9-4bea-90a3-e1e367e581fb",
      title: "Several repairs from previous years",
      desc: "Tighten left rear light, crack in front window (both layers), jockey wheel bracket, repair rear leg, repair grey plastic on roof rails.\n\nSeveral repairs from previous years: tighten left rear light, crack in front window (both layers), jockey wheel bracket, repair rear leg, repair grey plastic on roof rails.",
    },
    // "client gave us a brake cable for his trailer" → action-oriented
    {
      id: "f4c4fe19-3e8e-41a7-ac86-ec0d59e2389b",
      title: "Mount brake cable (client supplied), lights need repairing",
      desc: "Mount brake cable (client supplied), lights need repairing.",
    },
    // "ex client mirjan kok tyres from 2009..." → capitalize names
    {
      id: "12760d3e-1954-4580-b718-8d40d50fbaa1",
      title:
        "Ex-client Mirjan Kok. Tyres from 2009 (155/80R12 1209), left rear light broken",
      desc: "Ex-client Mirjan Kok. Tyres from 2009 (155/80R12 1209), left rear light broken.",
    },
    // "Paid in Nov still to be done..." → cleaner
    {
      id: "5d7cf09b-fb03-4261-855e-b2f949f15f65",
      title:
        "Paid in Nov, still to be done — tyres from 2015 (145/70R13 - 4315)",
      desc: "Lights need repairing.\n\nPaid in Nov, still to be done — tyres from 2015 (145/70R13 - 4315), lights need repairing.",
    },
    // "beading (bigger size dethleffs)" → capitalize brand name
    {
      id: "bdc756c7-8478-482f-8e90-73c58be9e010",
      title: "Beading (bigger size Dethleffs), side skirt loose from caravan",
      desc: "Beading (bigger size Dethleffs), side skirt loose from caravan",
    },
    // "We mounted new tyres last year but it keeps loosing air" → "losing" + desc fix
    {
      id: "8c7e86a6-7113-4bc5-b8eb-26ea52fb6f8d",
      title: "We mounted new tyres last year but it keeps losing air",
      desc: "Think we need to check the rim, lights need repairing.\n\nWe mounted new tyres last year but it keeps losing air. Think we need to check the rim, lights need repairing.",
    },
    // "client request repairs" → past tense
    {
      id: "b0520f04-792f-4d96-a6a6-6c6ccb7040de",
      title: "Client requested repairs",
      desc: "Client requested repairs",
    },
    // "Severall repairs. See email." → "Several" (bulk handles this but also fix period placement)
    {
      id: "28a50f43-4428-4d06-8689-6e244ce6e011",
      title: "Several repairs — see email",
      desc: "Several repairs — see email",
    },
  ];

  for (const fix of fixes) {
    if (fix.desc !== undefined) {
      const result = await sql`UPDATE repair_jobs SET title = ${fix.title}, description_raw = ${fix.desc} WHERE id = ${fix.id} RETURNING id`;
      if (result.length > 0) {
        console.log(
          `  ✓ "${fix.title.substring(0, 70)}${fix.title.length > 70 ? "..." : ""}"`
        );
        totalUpdates += 1;
      } else {
        console.log(`  ⚠ Not found: ${fix.id}`);
      }
    } else {
      const result = await sql`UPDATE repair_jobs SET title = ${fix.title} WHERE id = ${fix.id} RETURNING id`;
      if (result.length > 0) {
        console.log(`  ✓ "${fix.title}"`);
        totalUpdates += 1;
      } else {
        console.log(`  ⚠ Not found: ${fix.id}`);
      }
    }
  }

  console.log(`\n=== Complete! Total field updates: ${totalUpdates} ===`);
}

main().catch(console.error);
