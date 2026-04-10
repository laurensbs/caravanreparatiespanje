import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNull, sql, ilike, or, ne } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const client = neon(process.env.DATABASE_URL!);
const db = drizzle({ client, schema });

async function analyze() {
  // 1. Get all todo repairs (not deleted)
  const todos = await db.query.repairJobs.findMany({
    where: and(
      eq(schema.repairJobs.status, "todo"),
      isNull(schema.repairJobs.deletedAt)
    ),
    with: {
      customer: true,
      unit: true,
      location: true,
    },
    orderBy: [schema.repairJobs.createdAt],
  });

  console.log(`\n=== TOTAL TODO REPAIRS: ${todos.length} ===\n`);

  // 2. Find potential duplicates: same customer + similar title/description
  console.log("=== POTENTIAL DUPLICATES (same customer + similar title) ===\n");
  const dupeGroups: Map<string, typeof todos> = new Map();
  
  for (const job of todos) {
    // Key: customerId + normalized title prefix
    const custKey = job.customerId ?? "no-customer";
    const titleKey = (job.title ?? job.descriptionRaw ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const key = `${custKey}::${titleKey}`;
    
    if (!dupeGroups.has(key)) {
      dupeGroups.set(key, []);
    }
    dupeGroups.get(key)!.push(job);
  }

  let dupeCount = 0;
  for (const [key, group] of dupeGroups) {
    if (group.length > 1) {
      dupeCount += group.length;
      const cust = group[0].customer?.name ?? "No customer";
      console.log(`  [${group.length}x] Customer: ${cust}`);
      for (const j of group) {
        const title = (j.title ?? j.descriptionRaw ?? "").slice(0, 80);
        const unit = j.unit ? `${j.unit.brand ?? ""} ${j.unit.model ?? ""} ${j.unit.registration ?? ""}`.trim() : "no unit";
        console.log(`    - ${j.id.slice(0, 8)} | "${title}" | Unit: ${unit} | Created: ${j.createdAt.toISOString().slice(0, 10)}`);
      }
      console.log();
    }
  }
  console.log(`  → ${dupeCount} repairs in duplicate groups\n`);

  // 3. Also find duplicates by unit + similar description
  console.log("=== POTENTIAL DUPLICATES (same unit + similar description) ===\n");
  const unitGroups: Map<string, typeof todos> = new Map();
  
  for (const job of todos) {
    if (!job.unitId) continue;
    const descKey = (job.title ?? job.descriptionRaw ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const key = `${job.unitId}::${descKey}`;
    
    if (!unitGroups.has(key)) {
      unitGroups.set(key, []);
    }
    unitGroups.get(key)!.push(job);
  }

  let unitDupeCount = 0;
  for (const [key, group] of unitGroups) {
    if (group.length > 1) {
      unitDupeCount += group.length;
      const unit = group[0].unit ? `${group[0].unit.brand ?? ""} ${group[0].unit.model ?? ""} ${group[0].unit.registration ?? ""}`.trim() : "?";
      console.log(`  [${group.length}x] Unit: ${unit}`);
      for (const j of group) {
        const title = (j.title ?? j.descriptionRaw ?? "").slice(0, 80);
        const cust = j.customer?.name ?? "no customer";
        console.log(`    - ${j.id.slice(0, 8)} | "${title}" | Customer: ${cust}`);
      }
      console.log();
    }
  }
  console.log(`  → ${unitDupeCount} repairs in unit-based duplicate groups\n`);

  // 4. Business process types breakdown
  console.log("=== BUSINESS PROCESS TYPES ===\n");
  const bpCounts: Record<string, number> = {};
  for (const j of todos) {
    const bp = j.businessProcessType ?? "unknown";
    bpCounts[bp] = (bpCounts[bp] || 0) + 1;
  }
  for (const [bp, count] of Object.entries(bpCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bp}: ${count}`);
  }
  console.log();

  // 5. Repairs that may already be done but still marked todo
  // (have invoice, or completed/archived timestamps)
  console.log("=== POSSIBLY ALREADY DONE (has invoice or completion data) ===\n");
  let alreadyDone = 0;
  for (const j of todos) {
    const reasons: string[] = [];
    if (j.holdedInvoiceId) reasons.push(`has invoice ${j.holdedInvoiceNum}`);
    if (j.holdedQuoteId) reasons.push(`has quote ${j.holdedQuoteNum}`);
    if (j.completedAt) reasons.push(`completed ${j.completedAt.toISOString().slice(0, 10)}`);
    if (j.invoiceStatus === "paid") reasons.push("invoice paid");
    if (j.invoiceStatus === "sent") reasons.push("invoice sent");
    if (j.invoiceStatus === "warranty") reasons.push("warranty");
    if (j.invoiceStatus === "no_damage") reasons.push("no damage");
    
    if (reasons.length > 0) {
      alreadyDone++;
      const title = (j.title ?? j.descriptionRaw ?? "").slice(0, 60);
      console.log(`  ${j.id.slice(0, 8)} | "${title}" | ${reasons.join(", ")}`);
    }
  }
  console.log(`  → ${alreadyDone} todo repairs appear already done\n`);

  // 6. Non-repair process types that shouldn't be in todo
  console.log("=== NON-REPAIR PROCESS TYPES in TODO ===\n");
  const nonRepair = todos.filter(j => 
    j.businessProcessType && !["repair", "unknown"].includes(j.businessProcessType)
  );
  for (const j of nonRepair) {
    const title = (j.title ?? j.descriptionRaw ?? "").slice(0, 60);
    console.log(`  ${j.id.slice(0, 8)} | type: ${j.businessProcessType} | "${title}"`);
  }
  console.log(`  → ${nonRepair.length} non-repair items\n`);

  // 7. Customers without holded_contact_id that might match
  console.log("=== CUSTOMERS WITHOUT HOLDED LINK ===\n");
  const unlinkCustomerIds = new Set<string>();
  for (const j of todos) {
    if (j.customer && !j.customer.holdedContactId) {
      unlinkCustomerIds.add(j.customerId!);
    }
  }
  
  // Get all customers that have holded IDs for matching
  const holdedCustomers = await db.query.customers.findMany({
    where: sql`${schema.customers.holdedContactId} IS NOT NULL`,
    columns: { id: true, name: true, holdedContactId: true, email: true, phone: true },
  });
  
  const unlinkedCustomers = await db.query.customers.findMany({
    where: isNull(schema.customers.holdedContactId),
    columns: { id: true, name: true, email: true, phone: true, provisional: true },
  });
  
  // Try to match by name similarity
  const potentialMatches: { unlinked: typeof unlinkedCustomers[0]; holdedMatch: typeof holdedCustomers[0] }[] = [];
  
  for (const unlinked of unlinkedCustomers) {
    if (!unlinkCustomerIds.has(unlinked.id)) continue;
    
    const normalizedName = unlinked.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    for (const hc of holdedCustomers) {
      const hName = hc.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      // Check exact match (after normalization)
      if (normalizedName === hName) {
        potentialMatches.push({ unlinked, holdedMatch: hc });
        break;
      }
      
      // Check if one contains the other (for partial name matches)
      if (normalizedName.length > 5 && hName.length > 5) {
        if (normalizedName.includes(hName) || hName.includes(normalizedName)) {
          potentialMatches.push({ unlinked, holdedMatch: hc });
          break;
        }
      }
      
      // Check email match
      if (unlinked.email && hc.email && unlinked.email.toLowerCase() === hc.email.toLowerCase()) {
        potentialMatches.push({ unlinked, holdedMatch: hc });
        break;
      }
      
      // Check phone match
      if (unlinked.phone && hc.phone) {
        const p1 = unlinked.phone.replace(/[^0-9]/g, "");
        const p2 = hc.phone.replace(/[^0-9]/g, "");
        if (p1.length > 6 && p1 === p2) {
          potentialMatches.push({ unlinked, holdedMatch: hc });
          break;
        }
      }
    }
  }
  
  console.log(`  Total unlinked customers on todo repairs: ${unlinkCustomerIds.size}`);
  console.log(`  Potential matches with Holded customers: ${potentialMatches.length}\n`);
  for (const m of potentialMatches) {
    console.log(`  MATCH: "${m.unlinked.name}" (${m.unlinked.id.slice(0, 8)}) → Holded: "${m.holdedMatch.name}" (holded: ${m.holdedMatch.holdedContactId})`);
  }
  console.log();

  // 8. Repairs without customer at all
  const noCustomer = todos.filter(j => !j.customerId);
  console.log(`=== REPAIRS WITHOUT ANY CUSTOMER: ${noCustomer.length} ===\n`);
  for (const j of noCustomer.slice(0, 20)) {
    const title = (j.title ?? j.descriptionRaw ?? "").slice(0, 60);
    console.log(`  ${j.id.slice(0, 8)} | "${title}"`);
  }
  if (noCustomer.length > 20) console.log(`  ... and ${noCustomer.length - 20} more`);
  console.log();

  // 9. Summary
  console.log("=== SUMMARY ===\n");
  console.log(`  Total todo repairs: ${todos.length}`);
  console.log(`  In duplicate groups (same customer+title): ${dupeCount}`);
  console.log(`  In duplicate groups (same unit+title): ${unitDupeCount}`);
  console.log(`  Already done (has invoice/completion): ${alreadyDone}`);
  console.log(`  Non-repair process types: ${nonRepair.length}`);
  console.log(`  Without customer: ${noCustomer.length}`);
  console.log(`  Customers matchable to Holded: ${potentialMatches.length}`);
}

analyze().catch(console.error);
