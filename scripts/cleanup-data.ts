import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function cleanup() {
  console.log("🔧 Starting data cleanup...\n");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DELETE JUNK HEADER ROWS (imported spreadsheet headers)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("1️⃣  Removing junk header repairs...");
  const junk = await sql`
    DELETE FROM repair_jobs
    WHERE title IN ('Name', 'repairs', 'name')
    OR title ILIKE 'check list form for yearly%'
    OR title = '(orange = our costs), (green = no damage)'
    RETURNING id, title
  `;
  console.log(`   Deleted ${junk.length} junk rows`);
  for (const r of junk) console.log(`   - "${r.title}"`);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. MARK "NO DAMAGE" INSPECTIONS AS COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Marking 'No damage' inspections as completed...");
  const noDamage = await sql`
    UPDATE repair_jobs
    SET status = 'completed',
        completed_at = NOW(),
        business_process_type = 'inspection',
        updated_at = NOW()
    WHERE title ILIKE '%no damage%'
    AND status != 'completed'
    AND (description_raw IS NULL OR description_raw = '' OR description_raw ILIKE '%no damage%')
    RETURNING id
  `;
  console.log(`   Completed ${noDamage.length} no-damage inspections`);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MOVE "SHEET1 (LEGACY)" REPAIRS TO CRUÏLLAS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Moving Sheet1 (Legacy) repairs to Cruïllas...");
  const cruillasId = await sql`SELECT id FROM locations WHERE slug = 'cruillas'`;
  const legacyId = await sql`SELECT id FROM locations WHERE slug = 'sheet1'`;
  if (cruillasId.length && legacyId.length) {
    const moved = await sql`
      UPDATE repair_jobs
      SET location_id = ${cruillasId[0].id},
          updated_at = NOW()
      WHERE location_id = ${legacyId[0].id}
      RETURNING id
    `;
    console.log(`   Moved ${moved.length} repairs to Cruïllas`);
    
    // Deactivate legacy location
    await sql`UPDATE locations SET active = false WHERE id = ${legacyId[0].id}`;
    console.log("   Deactivated 'Sheet1 (Legacy)' location");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. LINK UNITS TO CUSTOMERS VIA REPAIR JOBS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Linking units to customers via repair jobs...");
  const linked = await sql`
    UPDATE units u
    SET customer_id = sub.customer_id,
        updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (r.unit_id) r.unit_id, r.customer_id
      FROM repair_jobs r
      WHERE r.unit_id IS NOT NULL AND r.customer_id IS NOT NULL
      ORDER BY r.unit_id, r.updated_at DESC
    ) sub
    WHERE u.id = sub.unit_id
    AND u.customer_id IS NULL
    RETURNING u.id
  `;
  console.log(`   Linked ${linked.length} units to their customers`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CLEAN GARBAGE REGISTRATIONS (descriptions stored as kenteken)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Cleaning garbage registrations...");
  // Move long text from registration → notes, keep actual registrations
  const cleaned = await sql`
    UPDATE units
    SET notes = COALESCE(notes || E'\n', '') || 'Imported registration: ' || registration,
        registration_raw = registration,
        registration = NULL,
        updated_at = NOW()
    WHERE registration IS NOT NULL
    AND length(registration) > 15
    AND registration !~ '^[A-Z0-9]{1,4}[-][A-Z0-9]{2,4}[-][A-Z0-9]{2,4}$'
    RETURNING id
  `;
  console.log(`   Cleaned ${cleaned.length} garbage registrations → moved to notes`);

  // Also clean known garbage patterns in short registrations
  const cleanedShort = await sql`
    UPDATE units
    SET notes = COALESCE(notes || E'\n', '') || 'Imported registration: ' || registration,
        registration_raw = registration,
        registration = NULL,
        updated_at = NOW()
    WHERE registration IS NOT NULL
    AND registration IN ('si', 'no', 'yes', 'Hobby', 'LMC', 'No es necesario.', 'no es necesario', 'volver a sant climent')
    RETURNING id
  `;
  console.log(`   Cleaned ${cleanedShort.length} more known-bad registrations`);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SPLIT LONG TITLES → SHORT TITLE + DESCRIPTION
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n6️⃣  Splitting long titles into title + description...");
  
  // Get all repairs with long titles that don't already have a description
  const longTitles = await sql`
    SELECT id, title, description_raw FROM repair_jobs
    WHERE length(title) > 80
  `;
  
  let splitCount = 0;
  for (const r of longTitles) {
    const title = r.title as string;
    
    // Strategy: take first clause (before first comma or period) as title, rest as description
    let splitIdx = -1;
    
    // Try splitting at first comma (if it gives a reasonable title)
    const commaIdx = title.indexOf(",");
    if (commaIdx > 10 && commaIdx < 80) {
      splitIdx = commaIdx;
    }
    
    // If no good comma, try first period
    if (splitIdx === -1) {
      const dotIdx = title.indexOf(".");
      if (dotIdx > 10 && dotIdx < 80) {
        splitIdx = dotIdx;
      }
    }
    
    // If still nothing, take first 60 chars at a word boundary
    if (splitIdx === -1) {
      const sub = title.substring(0, 70);
      const lastSpace = sub.lastIndexOf(" ");
      if (lastSpace > 20) {
        splitIdx = lastSpace;
      } else {
        continue; // Can't split cleanly
      }
    }
    
    const newTitle = title.substring(0, splitIdx).trim();
    const extraDesc = title.substring(splitIdx + 1).trim();
    
    if (!newTitle || !extraDesc) continue;
    
    // Merge the rest into description
    const existingDesc = r.description_raw || "";
    const newDesc = existingDesc 
      ? extraDesc + "\n\n" + existingDesc
      : extraDesc;
    
    await sql`
      UPDATE repair_jobs
      SET title = ${newTitle},
          description_raw = ${newDesc},
          updated_at = NOW()
      WHERE id = ${r.id}
    `;
    splitCount++;
  }
  console.log(`   Split ${splitCount} long titles`);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. ARCHIVE IMPORT ERROR REPAIRS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Archiving import error repairs...");
  const archived = await sql`
    UPDATE repair_jobs
    SET archived_at = NOW(),
        status = 'archived',
        updated_at = NOW()
    WHERE title LIKE 'Import: Master row%'
    AND customer_id IS NULL
    RETURNING id
  `;
  console.log(`   Archived ${archived.length} import error repairs`);

  // ─────────────────────────────────────────────────────────────────────────
  // 8. AUTO-PRIORITIZE BASED ON FLAGS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n8️⃣  Auto-prioritizing based on flags...");
  
  // Water damage → urgent
  const urgentWater = await sql`
    UPDATE repair_jobs
    SET priority = 'urgent', updated_at = NOW()
    WHERE water_damage_risk_flag = true
    AND priority = 'normal'
    AND archived_at IS NULL
    RETURNING id
  `;
  console.log(`   → urgent (water damage): ${urgentWater.length}`);
  
  // Safety flag → high
  const highSafety = await sql`
    UPDATE repair_jobs
    SET priority = 'high', updated_at = NOW()
    WHERE (safety_flag = true OR brakes_flag = true)
    AND priority = 'normal'
    AND archived_at IS NULL
    RETURNING id
  `;
  console.log(`   → high (safety/brakes): ${highSafety.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 9. INFER UNIT TYPES FROM DESCRIPTIONS & BRAND
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n9️⃣  Inferring unit types...");
  
  // Caravan brands/keywords
  const caravans = await sql`
    UPDATE units
    SET unit_type = 'caravan', updated_at = NOW()
    WHERE unit_type = 'unknown'
    AND (
      brand ILIKE ANY(ARRAY['%hobby%', '%fendt%', '%knaus%', '%dethleffs%', '%adria%', '%burstner%', '%caravelair%', '%eriba%', '%tabbert%', '%sprite%', '%swift%', '%bailey%', '%elddis%', '%lunar%', '%coachman%', '%avondale%', '%compass%', '%fleetwood%', '%sterling%'])
      OR notes ILIKE '%caravan%'
      OR registration_raw ILIKE '%caravan%'
    )
    RETURNING id
  `;
  console.log(`   → caravan: ${caravans.length}`);
  
  // Trailer keywords
  const trailers = await sql`
    UPDATE units
    SET unit_type = 'trailer', updated_at = NOW()
    WHERE unit_type = 'unknown'
    AND (
      brand ILIKE '%trailer%'
      OR notes ILIKE '%trailer%'
      OR notes ILIKE '%jetski%'
      OR registration_raw ILIKE '%trailer%'
    )
    RETURNING id
  `;
  console.log(`   → trailer: ${trailers.length}`);
  
  // Camper keywords
  const campers = await sql`
    UPDATE units
    SET unit_type = 'camper', updated_at = NOW()
    WHERE unit_type = 'unknown'
    AND (
      brand ILIKE '%camper%'
      OR notes ILIKE '%camper%'
      OR notes ILIKE '%motorhome%'
      OR registration_raw ILIKE '%camper%'
    )
    RETURNING id
  `;
  console.log(`   → camper: ${campers.length}`);

  // Most units on this site are caravans - mark remaining with repairs as caravan
  const defaultCaravan = await sql`
    UPDATE units
    SET unit_type = 'caravan', updated_at = NOW()
    WHERE unit_type = 'unknown'
    AND EXISTS (SELECT 1 FROM repair_jobs r WHERE r.unit_id = units.id AND r.business_process_type = 'repair')
    RETURNING id
  `;
  console.log(`   → caravan (default for repair jobs): ${defaultCaravan.length}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 10. DELETE SUSPICIOUS NUMERIC-ONLY CUSTOMER NAMES
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n🔟  Cleaning suspicious customer names...");
  // First unlink from repairs
  const numericCustomers = await sql`
    SELECT id, name FROM customers WHERE name ~ '^[0-9]+$'
  `;
  for (const c of numericCustomers) {
    await sql`UPDATE repair_jobs SET customer_id = NULL WHERE customer_id = ${c.id}`;
    await sql`UPDATE units SET customer_id = NULL WHERE customer_id = ${c.id}`;
    await sql`DELETE FROM customers WHERE id = ${c.id}`;
  }
  console.log(`   Removed ${numericCustomers.length} numeric-name customers`);

  // ─────────────────────────────────────────────────────────────────────────
  // 11. NORMALIZE UNIT BRANDS (capitalize, merge variants)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣1️⃣  Normalizing unit brands...");
  const brandMap: Record<string, string> = {
    "hobby": "Hobby",
    "fendt": "Fendt",
    "knaus": "Knaus",
    "dethleffs": "Dethleffs",
    "adria": "Adria",
    "burstner": "Bürstner",
    "bürstner": "Bürstner",
    "caravelair": "Caravelair",
    "eriba": "Eriba",
    "tabbert": "Tabbert",
    "sprite": "Sprite",
    "swift": "Swift",
    "bailey": "Bailey", 
    "elddis": "Elddis",
    "lunar": "Lunar",
    "coachman": "Coachman",
    "lmc": "LMC",
    "trigano": "Trigano",
    "weinsberg": "Weinsberg",
    "kip": "Kip",
    "beyerland": "Beyerland",
  };
  
  let brandFixed = 0;
  for (const [pattern, proper] of Object.entries(brandMap)) {
    const fixed = await sql`
      UPDATE units SET brand = ${proper}, updated_at = NOW()
      WHERE lower(trim(brand)) = ${pattern} AND brand != ${proper}
      RETURNING id
    `;
    brandFixed += fixed.length;
  }
  console.log(`   Normalized ${brandFixed} brand names`);

  // ─────────────────────────────────────────────────────────────────────────
  // 12. SET PROVISIONAL = FALSE FOR VERIFIED CUSTOMERS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣2️⃣  Un-flagging provisional records with real data...");
  const unProv = await sql`
    UPDATE customers
    SET provisional = false, updated_at = NOW()
    WHERE provisional = true
    AND length(trim(name)) > 2
    AND name !~ '^[0-9]+$'
    RETURNING id
  `;
  console.log(`   Un-flagged ${unProv.length} provisional customers`);

  const unProvUnits = await sql`
    UPDATE units
    SET provisional = false, updated_at = NOW()
    WHERE provisional = true
    AND customer_id IS NOT NULL
    RETURNING id
  `;
  console.log(`   Un-flagged ${unProvUnits.length} provisional units (have customer)`);

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("✅ CLEANUP COMPLETE - Final counts:");
  const final = await sql`
    SELECT
      (SELECT count(*) FROM customers) as customers,
      (SELECT count(*) FROM units) as units,
      (SELECT count(*) FROM repair_jobs) as repairs,
      (SELECT count(*) FROM repair_jobs WHERE archived_at IS NOT NULL) as archived,
      (SELECT count(*) FROM repair_jobs WHERE status = 'completed') as completed,
      (SELECT count(*) FROM repair_jobs WHERE priority != 'normal') as prioritized,
      (SELECT count(*) FROM units WHERE unit_type != 'unknown') as typed_units,
      (SELECT count(*) FROM units WHERE customer_id IS NOT NULL) as units_with_customer
  `;
  console.log(final[0]);

  process.exit(0);
}

cleanup().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
