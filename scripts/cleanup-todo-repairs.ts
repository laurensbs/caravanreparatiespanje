import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const client = neon(process.env.DATABASE_URL!);
const db = drizzle({ client, schema });

const DRY_RUN = process.argv.includes("--dry-run");

async function log(action: string, detail: string) {
  console.log(`  ${DRY_RUN ? "[DRY] " : ""}${action}: ${detail}`);
}

async function cleanup() {
  if (DRY_RUN) console.log("=== DRY RUN MODE (no changes) ===\n");
  else console.log("=== EXECUTING CLEANUP ===\n");

  const now = new Date();
  let totalArchived = 0;
  let totalCompleted = 0;
  let totalDeleted = 0;
  let totalCustomersMerged = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. WARRANTY repairs stuck in TODO → mark completed
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("── 1. WARRANTY REPAIRS → completed ──\n");
  
  const warrantyTodos = await db.query.repairJobs.findMany({
    where: and(
      eq(schema.repairJobs.status, "todo"),
      isNull(schema.repairJobs.deletedAt),
      eq(schema.repairJobs.invoiceStatus, "warranty")
    ),
    columns: { id: true, title: true, descriptionRaw: true },
  });

  for (const j of warrantyTodos) {
    const title = (j.title ?? j.descriptionRaw ?? "").slice(0, 60);
    log("COMPLETE", `${j.id.slice(0, 8)} | "${title}"`);
    if (!DRY_RUN) {
      await db.update(schema.repairJobs)
        .set({ 
          status: "completed", 
          completedAt: now, 
          updatedAt: now,
          statusReason: "Auto-completed: already marked as warranty/internal cost",
        })
        .where(eq(schema.repairJobs.id, j.id));
    }
    totalCompleted++;
  }
  console.log(`  → ${totalCompleted} warranty repairs completed\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EXACT DUPLICATES → soft-delete the spare
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("── 2. EXACT DUPLICATES → soft-delete ──\n");

  // Pair 1: "135/80-13T TOURING(70) TAURUS" — both have no customer, no unit
  // Keep 2cb7932b, delete 084f8dc4
  const dupeDeletes = [
    { keep: "2cb7932b", delete: "084f8dc4", reason: "Exact duplicate: 135/80-13T TOURING(70) TAURUS" },
  ];

  // Pair 2: "rear lights arent working" — e6b8ac63 (no unit) vs 8cd77579 (has unit)
  // Keep 8cd77579 (has unit), delete e6b8ac63 (no unit)
  dupeDeletes.push({ 
    keep: "8cd77579", delete: "e6b8ac63", 
    reason: "Exact duplicate: rear lights arent working (keeping one with unit)" 
  });

  // Unit dupe: Adria Adiva — 0b488550 (Dhr. J. van Klaveren) vs e3a7e795 (Pa26)
  // Keep 0b488550 (real customer), delete e3a7e795 (Pa26 = parking reference)
  dupeDeletes.push({
    keep: "0b488550", delete: "e3a7e795",
    reason: "Unit duplicate: Adria Adiva - same description, Pa26 is position reference",
  });

  for (const d of dupeDeletes) {
    // Find full ID by prefix
    const fullId = await db.execute(
      sql`SELECT id FROM repair_jobs WHERE id::text LIKE ${d.delete + '%'} LIMIT 1`
    );
    if (fullId.rows.length === 0) {
      console.log(`  SKIP: could not find repair starting with ${d.delete}`);
      continue;
    }
    const id = (fullId.rows[0] as any).id;
    log("SOFT-DELETE", `${d.delete} | ${d.reason}`);
    if (!DRY_RUN) {
      await db.update(schema.repairJobs)
        .set({ deletedAt: now, updatedAt: now, statusReason: `Duplicate removed: ${d.reason}` })
        .where(eq(schema.repairJobs.id, id));
    }
    totalDeleted++;
  }
  console.log(`  → ${totalDeleted} duplicates soft-deleted\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. INTERNAL/LOGISTICS TASKS without customer → archive
  //    (notes, reminders, logistics — not actual repair jobs)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("── 3. INTERNAL TASKS → archived ──\n");

  // These are clearly not repair jobs — they're internal notes/logistics
  const archivePrefixes = [
    // Logistics moves
    "f2cc1351", // "bring back from cruillas to sant climent to repair"
    "b083db1c", // "llevar de vuelta a sant climent para hacer reparacion"
    "d6cda52e", // "hacer reparacion alli en cruillas o sacar la pieza"
    "e3f49f83", // "aparcar caravans en la fila"
    "7244e25d", // "escribir ubicaciones (todas)"
    "2b8387a8", // "bring back to sant climent/ volver a Sant Climent"
    "1d686a1b", // "bring back to sant climent" (Peratallada)
    "31b4d2d7", // "next to repair"
    "1a446eff", // "next"
    // Generic notes / not a repair
    "4aa6d940", // "hnwq-eeeb-gcij-kuds-psjt" (random string)
    "f8c75d69", // "mark repairs for cruillas"
    "69aef962", // "Mark repairs" 
    "32093360", // "peratallada repairs" (generic)
    "8818d906", // "Need parts or problems" (generic note)
    "e04befba", // "the boys"
    "bedb8098", // "repaired" (already done, no info)
    "942f2ec0", // "Peratallada Afuera" (location note)
    "0d0c5869", // "next sant climent repairs"
    "7934c898", // "work for kees" (generic task)
    "321ac1d3", // "things to go through with johan" (meeting note)
    "84afceae", // "jake to contact" (contact reminder)
    "b9d61e96", // "clients to call to get confirmation for repair" (task note)
    "9da465ae", // "Mark" (just a name)
    "275672bd", // "Josue" (just a name)
    "0acd62c7", // "felipe" (just a name)
    "54d2683f", // "joshua" (just a name)
    "866bda4e", // "Michael" (just a name)
  ];

  for (const prefix of archivePrefixes) {
    const result = await db.execute(
      sql`SELECT id, COALESCE(title, description_raw, '') as title FROM repair_jobs WHERE id::text LIKE ${prefix + '%'} AND status = 'todo' AND deleted_at IS NULL LIMIT 1`
    );
    if (result.rows.length === 0) {
      console.log(`  SKIP: ${prefix} not found or not in todo`);
      continue;
    }
    const row = result.rows[0] as any;
    log("ARCHIVE", `${prefix} | "${(row.title as string).slice(0, 50)}"`);
    if (!DRY_RUN) {
      await db.update(schema.repairJobs)
        .set({ 
          status: "archived", 
          archivedAt: now, 
          updatedAt: now,
          statusReason: "Auto-archived: internal task/note, not a customer repair",
        })
        .where(eq(schema.repairJobs.id, row.id));
    }
    totalArchived++;
  }
  console.log(`  → ${totalArchived} internal tasks archived\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LINK CUSTOMERS TO HOLDED
  //    Match unlinked customers to their Holded counterparts
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("── 4. LINK CUSTOMERS → Holded ──\n");

  // These are verified matches (from analysis) — skip dubious ones like "Camper"
  const customerLinks: { unlinkedPrefix: string; holdedId: string; from: string; to: string }[] = [
    { unlinkedPrefix: "05222bd4", holdedId: "692e8305f7ebec9ea9043d0d", from: "van der Ploeg", to: "Dhr/mevr. Johan van der Ploeg" },
    { unlinkedPrefix: "808baa40", holdedId: "692e82d5914e56f36f0e5d39", from: "Schouwenburghoeflaken", to: "Dhr/mevr. B. van Schouwenburg/Hoeflaken" },
    { unlinkedPrefix: "ccd310b8", holdedId: "692e82ebfc43168535088ab3", from: "Hoogen (trailer)", to: "Hoogen" },
    { unlinkedPrefix: "e84c8b3c", holdedId: "692e82fbaa2fef5b6d052c00", from: "Verkerk", to: "Mevr. Nicole Verkerk - van Beek" },
    { unlinkedPrefix: "08b786a0", holdedId: "692e82d6914e56f36f0e5d44", from: "Gronckel", to: "Dhr. M. de Gronckel" },
    { unlinkedPrefix: "8f5050d6", holdedId: "692e82f26cb980dad7065a98", from: "de Vree", to: "Dhr/mevr. Wilhelmus de Vree" },
    { unlinkedPrefix: "d9d872a0", holdedId: "692e82d23039157b450e687e", from: "Kalkeren", to: "Dhr. A. van Kalkeren" },
    { unlinkedPrefix: "cd6f3b06", holdedId: "692e82e4b3bec7ceef0f4963", from: "Maes Deer", to: "Mevr. Rita Maes / D'Eer" },
    { unlinkedPrefix: "81a3f671", holdedId: "692e83246683bd65730e37d0", from: "van der Vlist", to: "Dhr/mevr. Konstant van der Vlist" },
    { unlinkedPrefix: "83d6107e", holdedId: "692e830c809969a14c0c9064", from: "van Harten", to: "Dhr. David van Harten" },
    { unlinkedPrefix: "62dac106", holdedId: "692e832f165ddcd44409477c", from: "van Ewijk", to: "Dhr/mevr. Bert van Ewijk" },
    { unlinkedPrefix: "2af3412f", holdedId: "692e830fcbc71dd69f029f83", from: "van de Zwart", to: "Dhr. Nico van de Zwart" },
    { unlinkedPrefix: "ed8b011e", holdedId: "692e8307aaf0dbe6ff00899e", from: "van Wijk", to: "Dhr/mevr. Cathelijne van Wijk" },
    { unlinkedPrefix: "8404797d", holdedId: "692e831365b6e8ea3a0a8073", from: "van Leeuwen", to: "Dhr/mevr. Plonie van Leeuwen" },
    { unlinkedPrefix: "01ee4a65", holdedId: "692e82ff585929eac709dfb5", from: "van den Elsen", to: "Dhr/mevr. Kolja van den Elsen" },
    { unlinkedPrefix: "07ba387d", holdedId: "692e82ff585929eac709dfb2", from: "van Arnhem", to: "Mevr. Marlous van Arnhem" },
    { unlinkedPrefix: "dd74a84d", holdedId: "692e82f78216d71f59028fe4", from: "Dommelen", to: "Dhr/mevr. Lejo van Dommelen" },
    { unlinkedPrefix: "4ae058a7", holdedId: "692e82f9aa2fef5b6d052bdd", from: "van Lierop", to: "Dhr/mevr. Ad / Petra van Lierop" },
    { unlinkedPrefix: "7d9a6812", holdedId: "692e8306aaf0dbe6ff008994", from: "van Riel", to: "Dhr/mevr. Tessa van Riel" },
    { unlinkedPrefix: "264049c5", holdedId: "692e831f8ec1e246500db957", from: "van der Toorn", to: "Gijs van der Toorn" },
    { unlinkedPrefix: "5046395c", holdedId: "692e832bc498966369012b0d", from: "van Scheppingen", to: "Dhr/mevr. Samantha van Scheppingen" },
    { unlinkedPrefix: "968bb23f", holdedId: "692e8331165ddcd444094790", from: "van Reijsen", to: "Dhr/mevr. Arthur van Reijsen 2" },
    { unlinkedPrefix: "26245715", holdedId: "692e8327b366ec7c5d0c937d", from: "van Lith Kers", to: "Dhr/mevr. Gerard en Sylvia van Lith Kers" },
    { unlinkedPrefix: "ccecdb93", holdedId: "692e82d23039157b450e687c", from: "Verlaat", to: "Dhr. G. van 't Verlaat" },
    { unlinkedPrefix: "d19f72b2", holdedId: "692e832dc498966369012b33", from: "van Loon", to: "Dhr/mevr. Michel van Loon" },
    { unlinkedPrefix: "d7342889", holdedId: "692e8331165ddcd444094798", from: "van den Hout", to: "Dhr/mevr. Jan van den Hout" },
    { unlinkedPrefix: "40a42877", holdedId: "692e82fd585929eac709dfa2", from: "Blanco", to: "Blanco, Mario" },
    { unlinkedPrefix: "12fd0c6f", holdedId: "692e82f9aa2fef5b6d052bdf", from: "van Zoeren", to: "Dhr. Edwin van Zoeren" },
    // SKIP: "Camper" → "Masquecamper" — too generic, likely wrong match
  ];

  for (const link of customerLinks) {
    // Find the unlinked customer by prefix
    const unlinked = await db.execute(
      sql`SELECT id, name FROM customers WHERE id::text LIKE ${link.unlinkedPrefix + '%'} AND holded_contact_id IS NULL LIMIT 1`
    );
    if (unlinked.rows.length === 0) {
      console.log(`  SKIP: ${link.from} (${link.unlinkedPrefix}) not found or already linked`);
      continue;
    }

    // Check if the holded customer already exists in DB (different ID)
    const holdedExists = await db.execute(
      sql`SELECT id, name FROM customers WHERE holded_contact_id = ${link.holdedId} LIMIT 1`
    );

    const unlinkedId = (unlinked.rows[0] as any).id;

    if (holdedExists.rows.length > 0) {
      // The Holded customer already exists — we need to merge:
      // Move all repairs from unlinked → holded customer, then mark unlinked as provisional
      const holdedRow = holdedExists.rows[0] as any;
      log("MERGE", `"${link.from}" (${link.unlinkedPrefix}) → "${holdedRow.name}" (${(holdedRow.id as string).slice(0, 8)}, holded: ${link.holdedId})`);
      
      if (!DRY_RUN) {
        // Move repair jobs
        await db.execute(
          sql`UPDATE repair_jobs SET customer_id = ${holdedRow.id}, updated_at = ${now} WHERE customer_id = ${unlinkedId}`
        );
        // Move units
        await db.execute(
          sql`UPDATE units SET customer_id = ${holdedRow.id}, updated_at = ${now} WHERE customer_id = ${unlinkedId}`
        );
        // Mark old customer as provisional (can be cleaned up later)
        await db.update(schema.customers)
          .set({ provisional: true, notes: `Merged into ${holdedRow.name} (${holdedRow.id})`, updatedAt: now })
          .where(eq(schema.customers.id, unlinkedId));
      }
    } else {
      // No existing holded customer — just add the holded ID to the unlinked customer
      log("LINK", `"${link.from}" (${link.unlinkedPrefix}) → holded: ${link.holdedId} (${link.to})`);
      
      if (!DRY_RUN) {
        await db.update(schema.customers)
          .set({ holdedContactId: link.holdedId, updatedAt: now })
          .where(eq(schema.customers.id, unlinkedId));
      }
    }
    totalCustomersMerged++;
  }
  console.log(`  → ${totalCustomersMerged} customers linked/merged\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("══════════════════════════════════════");
  console.log(`  Warranty → completed: ${totalCompleted}`);
  console.log(`  Duplicates soft-deleted: ${totalDeleted}`);
  console.log(`  Internal tasks archived: ${totalArchived}`);
  console.log(`  Customers linked to Holded: ${totalCustomersMerged}`);
  console.log(`  ──────────────────────────`);
  console.log(`  Total repairs removed from TODO: ${totalCompleted + totalDeleted + totalArchived}`);
  console.log("══════════════════════════════════════");
  
  if (DRY_RUN) {
    console.log("\nRe-run without --dry-run to apply changes.");
  }
}

cleanup().catch(console.error);
