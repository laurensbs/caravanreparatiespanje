/**
 * One-off: Carlos vs Naomi — correcte contactgegevens + units per kenteken.
 *
 * Business rule (correctie t.o.v. eerdere split):
 * - Wilk WP-XS-52 → klant Carlos
 * - Caravelair WB-BD-84 → klant Naomi
 *
 * Zet Carlos' panel-gegevens (email/adres/GSM) en koppel units + actieve repairs.
 * Als Carlos per ongeluk dezelfde holded_contact_id als Naomi had, wordt die voor
 * Carlos gewist zodat push een eigen Holded-contact kan aanmaken.
 *
 * Holded — bestaande facturen/offertes:
 * Het Repair-systeem wijzigt geen historische PDF’s in Holded. Een contact-update
 * (na push) past het Holded-contact aan voor toekomstige documenten; oude draft/
 * verstuurde facturen kunnen in Holded nog de oude kop tonen — aanpassen in Holded
 * indien nodig (of contact op document wijzigen daar).
 *
 *   npx tsx scripts/realign-jubitana-carlos-naomi.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers, repairJobs, repairJobEvents, units } from "../src/lib/db/schema";
import { eq, ilike, and, isNull } from "drizzle-orm";

const NAOMI_CUSTOMER_ID = "3bae1e0b-9ca8-4264-8c23-84bbb0785532";

const WILK_REG = "WP-XS-52";
const CARAVELAIR_REG = "WB-BD-84";

const CARLOS_FIELDS = {
  name: "Dhr. Carlos Jubitana",
  email: "jubitana.carlos@gmail.com",
  address: "Alsemstraat 5",
  city: "Antwerpen",
  postalCode: "2050",
  province: "Antwerpen" as string | null,
  country: "Belgium",
  mobile: "+32476841117",
  phone: null as string | null,
};

async function findUnitByRegistration(reg: string) {
  const rows = await db.select().from(units).where(ilike(units.registration, reg));
  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const [naomi] = await db.select().from(customers).where(eq(customers.id, NAOMI_CUSTOMER_ID)).limit(1);
  if (!naomi) {
    console.error("Naomi customer not found:", NAOMI_CUSTOMER_ID);
    process.exit(1);
  }

  const carlosList = await db.select().from(customers).where(ilike(customers.name, "%Carlos%Jubitana%"));
  if (carlosList.length === 0) {
    console.error("No customer matching '%Carlos%Jubitana%'. Create Carlos first (e.g. split script) or fix name.");
    process.exit(1);
  }
  if (carlosList.length > 1) {
    console.error("Multiple Carlos Jubitana matches — resolve manually:", carlosList.map((c) => c.id));
    process.exit(1);
  }
  const carlos = carlosList[0]!;

  const wilkRows = await findUnitByRegistration(WILK_REG);
  const caravRows = await findUnitByRegistration(CARAVELAIR_REG);
  if (wilkRows.length !== 1) {
    console.error(`Expected exactly one unit for ${WILK_REG}, got`, wilkRows.length);
    process.exit(1);
  }
  if (caravRows.length !== 1) {
    console.error(`Expected exactly one unit for ${CARAVELAIR_REG}, got`, caravRows.length);
    process.exit(1);
  }

  const wilkUnit = wilkRows[0]!;
  const caravUnit = caravRows[0]!;

  let carlosHoldedId = carlos.holdedContactId;
  if (naomi.holdedContactId && carlosHoldedId === naomi.holdedContactId) {
    console.log("Carlos had same holded_contact_id as Naomi — clearing Carlos so a distinct Holded client can be linked.");
    carlosHoldedId = null;
  }

  await db
    .update(customers)
    .set({
      name: CARLOS_FIELDS.name,
      email: CARLOS_FIELDS.email,
      address: CARLOS_FIELDS.address,
      city: CARLOS_FIELDS.city,
      postalCode: CARLOS_FIELDS.postalCode,
      province: CARLOS_FIELDS.province,
      country: CARLOS_FIELDS.country,
      mobile: CARLOS_FIELDS.mobile,
      phone: CARLOS_FIELDS.phone,
      holdedContactId: carlosHoldedId,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, carlos.id));

  console.log("Updated Carlos customer row:", carlos.id);

  if (wilkUnit.customerId !== carlos.id) {
    await db
      .update(units)
      .set({ customerId: carlos.id, updatedAt: new Date() })
      .where(eq(units.id, wilkUnit.id));
    console.log(`Unit ${WILK_REG} (${wilkUnit.id}) → Carlos`);
  } else {
    console.log(`Unit ${WILK_REG} already on Carlos`);
  }

  if (caravUnit.customerId !== naomi.id) {
    await db
      .update(units)
      .set({ customerId: naomi.id, updatedAt: new Date() })
      .where(eq(units.id, caravUnit.id));
    console.log(`Unit ${CARAVELAIR_REG} (${caravUnit.id}) → Naomi`);
  } else {
    console.log(`Unit ${CARAVELAIR_REG} already on Naomi`);
  }

  const wilkJobs = await db
    .select()
    .from(repairJobs)
    .where(and(eq(repairJobs.unitId, wilkUnit.id), isNull(repairJobs.deletedAt)));

  for (const job of wilkJobs) {
    if (job.customerId === carlos.id) continue;
    await db.update(repairJobs).set({ customerId: carlos.id, updatedAt: new Date() }).where(eq(repairJobs.id, job.id));
    await db.insert(repairJobEvents).values({
      repairJobId: job.id,
      userId: null,
      eventType: "field_changed",
      fieldChanged: "customerId",
      oldValue: job.customerId ?? "",
      newValue: carlos.id,
      comment: "Data fix: Wilk WP-XS-52 → Carlos (realign script)",
    });
    console.log("Repair", job.id, "→ Carlos");
  }

  const caravJobs = await db
    .select()
    .from(repairJobs)
    .where(and(eq(repairJobs.unitId, caravUnit.id), isNull(repairJobs.deletedAt)));

  for (const job of caravJobs) {
    if (job.customerId === naomi.id) continue;
    await db.update(repairJobs).set({ customerId: naomi.id, updatedAt: new Date() }).where(eq(repairJobs.id, job.id));
    await db.insert(repairJobEvents).values({
      repairJobId: job.id,
      userId: null,
      eventType: "field_changed",
      fieldChanged: "customerId",
      oldValue: job.customerId ?? "",
      newValue: naomi.id,
      comment: "Data fix: Caravelair WB-BD-84 → Naomi (realign script)",
    });
    console.log("Repair", job.id, "→ Naomi");
  }

  try {
    const { pushContactToHolded } = await import("../src/lib/holded/sync");
    const { isHoldedConfigured } = await import("../src/lib/holded/client");
    if (isHoldedConfigured()) {
      await pushContactToHolded(carlos.id);
      console.log("Holded: pushed Carlos contact");
      await pushContactToHolded(naomi.id);
      console.log("Holded: pushed Naomi contact");
    } else {
      console.log("Holded not configured in env — open each customer in the panel and save to sync.");
    }
  } catch (e) {
    console.warn("Holded push failed (non-fatal):", e);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
