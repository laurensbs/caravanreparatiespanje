import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function analyze() {
  // Basic counts
  const counts = await sql`
    SELECT 
      (SELECT count(*) FROM customers) as customers,
      (SELECT count(*) FROM units) as units,
      (SELECT count(*) FROM repair_jobs) as repairs,
      (SELECT count(*) FROM locations) as locations
  `;
  console.log("=== BASIC COUNTS ===");
  console.log(counts[0]);

  // Orphans
  console.log("\n=== ORPHANED RECORDS ===");
  const orphans = await sql`
    SELECT
      (SELECT count(*) FROM customers c WHERE NOT EXISTS (SELECT 1 FROM repair_jobs r WHERE r.customer_id = c.id)) as customers_no_repairs,
      (SELECT count(*) FROM units u WHERE NOT EXISTS (SELECT 1 FROM repair_jobs r WHERE r.unit_id = u.id)) as units_no_repairs,
      (SELECT count(*) FROM repair_jobs WHERE customer_id IS NULL) as repairs_no_customer,
      (SELECT count(*) FROM repair_jobs WHERE unit_id IS NULL) as repairs_no_unit,
      (SELECT count(*) FROM repair_jobs WHERE location_id IS NULL) as repairs_no_location,
      (SELECT count(*) FROM repair_jobs WHERE title IS NULL OR trim(title) = '') as repairs_no_title,
      (SELECT count(*) FROM repair_jobs WHERE description_raw IS NULL OR trim(description_raw) = '') as repairs_no_description
  `;
  console.log(orphans[0]);

  // Provisional
  console.log("\n=== PROVISIONAL (auto-created during import) ===");
  const prov = await sql`
    SELECT
      (SELECT count(*) FROM customers WHERE provisional = true) as provisional_customers,
      (SELECT count(*) FROM units WHERE provisional = true) as provisional_units
  `;
  console.log(prov[0]);

  // Duplicate customers by name
  console.log("\n=== DUPLICATE CUSTOMER NAMES (top 25) ===");
  const dupes = await sql`
    SELECT name, count(*) as cnt FROM customers 
    GROUP BY name HAVING count(*) > 1 
    ORDER BY cnt DESC LIMIT 25
  `;
  for (const r of dupes) console.log(`  ${r.cnt}x: "${r.name}"`);
  const totalDupes = await sql`
    SELECT count(*) as c FROM (
      SELECT name FROM customers GROUP BY name HAVING count(*) > 1
    ) sub
  `;
  console.log(`  Total duplicate name groups: ${totalDupes[0].c}`);

  // Suspicious names
  console.log("\n=== SUSPICIOUS CUSTOMER NAMES ===");
  const bad = await sql`
    SELECT id, name FROM customers 
    WHERE length(trim(name)) < 3 
    OR name ~ '^[0-9]+$' 
    OR name ~ '^\s*$'
    OR name ~* '^(test|unknown|n/a|none|-)$'
    LIMIT 30
  `;
  for (const r of bad) console.log(`  "${r.name}" (${r.id})`);
  console.log(`  Total suspicious: ${bad.length}`);

  // Status distribution
  console.log("\n=== REPAIR STATUS DISTRIBUTION ===");
  const statuses = await sql`SELECT status, count(*) as c FROM repair_jobs GROUP BY status ORDER BY c DESC`;
  for (const r of statuses) console.log(`  ${r.status}: ${r.c}`);

  // Invoice status
  console.log("\n=== INVOICE STATUS DISTRIBUTION ===");
  const inv = await sql`SELECT invoice_status, count(*) as c FROM repair_jobs GROUP BY invoice_status ORDER BY c DESC`;
  for (const r of inv) console.log(`  ${r.invoice_status}: ${r.c}`);

  // Business process type
  console.log("\n=== BUSINESS PROCESS TYPE ===");
  const bp = await sql`SELECT business_process_type, count(*) as c FROM repair_jobs GROUP BY business_process_type ORDER BY c DESC`;
  for (const r of bp) console.log(`  ${r.business_process_type}: ${r.c}`);

  // Customer response
  console.log("\n=== CUSTOMER RESPONSE STATUS ===");
  const cr = await sql`SELECT customer_response_status, count(*) as c FROM repair_jobs GROUP BY customer_response_status ORDER BY c DESC`;
  for (const r of cr) console.log(`  ${r.customer_response_status}: ${r.c}`);

  // Priority
  console.log("\n=== PRIORITY DISTRIBUTION ===");
  const pri = await sql`SELECT priority, count(*) as c FROM repair_jobs GROUP BY priority ORDER BY c DESC`;
  for (const r of pri) console.log(`  ${r.priority}: ${r.c}`);

  // Location distribution
  console.log("\n=== REPAIRS PER LOCATION ===");
  const locs = await sql`
    SELECT l.name, count(r.id) as c FROM locations l 
    LEFT JOIN repair_jobs r ON r.location_id = l.id 
    GROUP BY l.name ORDER BY c DESC
  `;
  for (const r of locs) console.log(`  ${r.name}: ${r.c}`);

  // Empty units
  console.log("\n=== EMPTY UNITS (no reg, brand, model) ===");
  const emptyUnits = await sql`
    SELECT count(*) as c FROM units 
    WHERE (registration IS NULL OR registration = '') 
    AND (brand IS NULL OR brand = '')
    AND (model IS NULL OR model = '')
  `;
  console.log(`  Count: ${emptyUnits[0].c}`);

  // Unit type distribution
  console.log("\n=== UNIT TYPE DISTRIBUTION ===");
  const ut = await sql`SELECT unit_type, count(*) as c FROM units GROUP BY unit_type ORDER BY c DESC`;
  for (const r of ut) console.log(`  ${r.unit_type}: ${r.c}`);

  // Customers with potential phone issues
  console.log("\n=== PHONE NUMBER ANALYSIS ===");
  const phones = await sql`
    SELECT 
      (SELECT count(*) FROM customers WHERE phone IS NULL OR phone = '') as no_phone,
      (SELECT count(*) FROM customers WHERE phone IS NOT NULL AND phone != '') as has_phone,
      (SELECT count(*) FROM customers WHERE phone IS NOT NULL AND length(phone) < 6) as short_phone
  `;
  console.log(phones[0]);

  // Email analysis
  console.log("\n=== EMAIL ANALYSIS ===");
  const emails = await sql`
    SELECT 
      (SELECT count(*) FROM customers WHERE email IS NULL OR email = '') as no_email,
      (SELECT count(*) FROM customers WHERE email IS NOT NULL AND email != '') as has_email,
      (SELECT count(*) FROM customers WHERE email IS NOT NULL AND email NOT LIKE '%@%') as invalid_email
  `;
  console.log(emails[0]);

  // Completed but not invoiced
  console.log("\n=== COMPLETED BUT NOT INVOICED ===");
  const compNoInv = await sql`
    SELECT count(*) as c FROM repair_jobs 
    WHERE status = 'completed' AND invoice_status = 'not_invoiced'
  `;
  console.log(`  Count: ${compNoInv[0].c}`);

  // Archived but not completed
  console.log("\n=== ARCHIVED STATUS BREAKDOWN ===");
  const archived = await sql`
    SELECT status, count(*) as c FROM repair_jobs 
    WHERE archived_at IS NOT NULL 
    GROUP BY status ORDER BY c DESC
  `;
  for (const r of archived) console.log(`  ${r.status}: ${r.c}`);

  // Sample repairs without title
  console.log("\n=== SAMPLE REPAIRS WITHOUT TITLE (5) ===");
  const noTitle = await sql`
    SELECT id, status, description_raw FROM repair_jobs 
    WHERE title IS NULL OR trim(title) = '' 
    LIMIT 5
  `;
  for (const r of noTitle) console.log(`  [${r.status}] ${(r.description_raw || "").substring(0, 80)}`);

  // Duplicate units (same registration)
  console.log("\n=== DUPLICATE UNIT REGISTRATIONS ===");
  const dupeUnits = await sql`
    SELECT registration, count(*) as cnt FROM units 
    WHERE registration IS NOT NULL AND registration != ''
    GROUP BY registration HAVING count(*) > 1 
    ORDER BY cnt DESC LIMIT 15
  `;
  for (const r of dupeUnits) console.log(`  ${r.cnt}x: "${r.registration}"`);

  // Customers with multiple units
  console.log("\n=== CUSTOMERS WITH MANY UNITS ===");
  const multiUnit = await sql`
    SELECT c.name, count(u.id) as unit_count FROM customers c
    JOIN units u ON u.customer_id = c.id
    GROUP BY c.id, c.name
    HAVING count(u.id) > 3
    ORDER BY unit_count DESC LIMIT 15
  `;
  for (const r of multiUnit) console.log(`  ${r.name}: ${r.unit_count} units`);

  // Age of repairs still open
  console.log("\n=== OLDEST OPEN REPAIRS ===");
  const oldest = await sql`
    SELECT id, title, status, created_at FROM repair_jobs
    WHERE archived_at IS NULL AND status NOT IN ('completed', 'invoiced')
    ORDER BY created_at ASC LIMIT 10
  `;
  for (const r of oldest) console.log(`  [${r.status}] ${r.created_at} - ${(r.title || "no title").substring(0, 60)}`);

  // Flags usage
  console.log("\n=== FLAG USAGE ===");
  const flags = await sql`
    SELECT
      (SELECT count(*) FROM repair_jobs WHERE water_damage_risk_flag = true) as water_damage,
      (SELECT count(*) FROM repair_jobs WHERE safety_flag = true) as safety,
      (SELECT count(*) FROM repair_jobs WHERE tyres_flag = true) as tyres,
      (SELECT count(*) FROM repair_jobs WHERE lights_flag = true) as lights,
      (SELECT count(*) FROM repair_jobs WHERE brakes_flag = true) as brakes,
      (SELECT count(*) FROM repair_jobs WHERE windows_flag = true) as windows,
      (SELECT count(*) FROM repair_jobs WHERE seals_flag = true) as seals,
      (SELECT count(*) FROM repair_jobs WHERE parts_required_flag = true) as parts_required,
      (SELECT count(*) FROM repair_jobs WHERE follow_up_required_flag = true) as follow_up,
      (SELECT count(*) FROM repair_jobs WHERE warranty_internal_cost_flag = true) as warranty,
      (SELECT count(*) FROM repair_jobs WHERE prepaid_flag = true) as prepaid
  `;
  console.log(flags[0]);

  process.exit(0);
}

analyze().catch(console.error);
