import { db } from "@/lib/db";
import { customers, suppliers, parts, units } from "@/lib/db/schema";
import {
  listContacts,
  listProducts,
  getContact,
  createContact,
  updateContact as updateHoldedContact,
  type HoldedContact,
  type HoldedProduct,
} from "@/lib/holded/invoices";
import { isHoldedConfigured } from "@/lib/holded/client";
import { eq, isNull, isNotNull } from "drizzle-orm";

// ─── Name normalization (for matching) ───

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/dhr\/mevr\.\s*/gi, "")
    .replace(/dhr\.\s*/gi, "")
    .replace(/mevr\.\s*/gi, "")
    .replace(/mr\.?\s*/gi, "")
    .replace(/mrs\.?\s*/gi, "")
    .replace(/ms\.?\s*/gi, "")
    .replace(/[,.\-\/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameKey(name: string): string {
  return normalize(name).split(" ").sort().join(" ");
}

// ─── Contact Sync Types ───

export interface SyncResult {
  matched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ─── Pull contacts from Holded → DB ───
// This is the main sync: Holded is source of truth for contact data.
// Matches by holdedContactId first, then by name, then by email.

export async function pullContacts(): Promise<SyncResult & { holdedTotal: number }> {
  if (!isHoldedConfigured()) throw new Error("Holded API not configured");

  const result: SyncResult & { holdedTotal: number } = {
    matched: 0, created: 0, updated: 0, skipped: 0, errors: [], holdedTotal: 0,
  };

  // 1. Fetch ALL contacts from Holded (paginated)
  const holdedContacts = await listContacts();
  result.holdedTotal = holdedContacts.length;

  // Separate by type
  const holdedClients = holdedContacts.filter(
    (c) => !c.type || c.type === "client" || c.type === "lead" || c.type === "debtor"
  );
  const holdedSuppliers = holdedContacts.filter(
    (c) => c.type === "supplier" || c.type === "creditor"
  );

  // 2. Get all existing DB contacts and suppliers
  const dbContacts = await db
    .select({ id: customers.id, name: customers.name, email: customers.email, holdedContactId: customers.holdedContactId })
    .from(customers);
  const dbSuppliers = await db
    .select({ id: suppliers.id, name: suppliers.name, email: suppliers.email, holdedContactId: suppliers.holdedContactId })
    .from(suppliers);

  // 3. Build lookup maps for DB contacts
  const dbByHoldedId = new Map<string, { id: string; name: string }>();
  const dbByNorm = new Map<string, { id: string; name: string }>();
  const dbByKey = new Map<string, { id: string; name: string }>();
  const dbByEmail = new Map<string, { id: string; name: string }>();

  for (const c of dbContacts) {
    if (c.holdedContactId) dbByHoldedId.set(c.holdedContactId, c);
    const norm = normalize(c.name);
    const key = nameKey(c.name);
    if (!dbByNorm.has(norm)) dbByNorm.set(norm, c);
    if (!dbByKey.has(key)) dbByKey.set(key, c);
    if (c.email) {
      const email = c.email.toLowerCase().trim();
      if (!dbByEmail.has(email)) dbByEmail.set(email, c);
    }
  }

  // 4. Supplier lookup
  const supplierByHoldedId = new Map<string, { id: string }>();
  const supplierByNorm = new Map<string, { id: string }>();
  for (const s of dbSuppliers) {
    if (s.holdedContactId) supplierByHoldedId.set(s.holdedContactId, s);
    const norm = normalize(s.name);
    if (!supplierByNorm.has(norm)) supplierByNorm.set(norm, s);
  }

  // 5. Sync client contacts: Holded → DB customers
  for (const hc of holdedClients) {
    try {
      const norm = normalize(hc.name);
      const key = nameKey(hc.name);
      const email = hc.email?.toLowerCase().trim();

      // Try to find existing DB contact
      let dbMatch = dbByHoldedId.get(hc.id);
      if (!dbMatch && dbByNorm.has(norm)) dbMatch = dbByNorm.get(norm);
      if (!dbMatch && dbByKey.has(key)) dbMatch = dbByKey.get(key);
      if (!dbMatch && email && dbByEmail.has(email)) dbMatch = dbByEmail.get(email);

      if (dbMatch) {
        // Link and update from Holded
        await db
          .update(customers)
          .set({
            holdedContactId: hc.id,
            holdedSyncedAt: new Date(),
            // Update phone/email from Holded if we have them
            ...(hc.phone ? { phone: hc.phone } : {}),
            ...(hc.email ? { email: hc.email } : {}),
            ...(hc.mobile ? { mobile: hc.mobile } : {}),
            ...(hc.vatnumber ? { vatnumber: hc.vatnumber } : {}),
            ...(hc.billAddress?.address ? { address: hc.billAddress.address } : {}),
            ...(hc.billAddress?.city ? { city: hc.billAddress.city } : {}),
            ...(hc.billAddress?.postalCode ? { postalCode: hc.billAddress.postalCode } : {}),
            ...(hc.billAddress?.province ? { province: hc.billAddress.province } : {}),
            ...(hc.billAddress?.country && hc.billAddress.country !== "España" ? { country: hc.billAddress.country } : {}),
            contactType: hc.isperson === false ? "business" : "person",
            updatedAt: new Date(),
          })
          .where(eq(customers.id, dbMatch.id));
        result.matched++;
      } else {
        // Skip contacts with very short or placeholder names
        if (norm.length < 2) {
          result.skipped++;
          continue;
        }
        // Create new customer from Holded contact
        await db.insert(customers).values({
          name: hc.name,
          email: hc.email || null,
          phone: hc.phone || null,
          mobile: hc.mobile || null,
          vatnumber: hc.vatnumber || null,
          contactType: hc.isperson === false ? "business" : "person",
          address: hc.billAddress?.address || null,
          city: hc.billAddress?.city || null,
          postalCode: hc.billAddress?.postalCode || null,
          province: hc.billAddress?.province || null,
          country: hc.billAddress?.country || null,
          holdedContactId: hc.id,
          holdedSyncedAt: new Date(),
          provisional: false,
        });
        result.created++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Contact "${hc.name}": ${msg}`);
    }
  }

  // 6. Sync supplier contacts: Holded → DB suppliers
  for (const hs of holdedSuppliers) {
    try {
      const norm = normalize(hs.name);
      let dbMatch = supplierByHoldedId.get(hs.id);
      if (!dbMatch && supplierByNorm.has(norm)) dbMatch = supplierByNorm.get(norm);

      if (dbMatch) {
        await db
          .update(suppliers)
          .set({
            holdedContactId: hs.id,
            ...(hs.phone ? { phone: hs.phone } : {}),
            ...(hs.email ? { email: hs.email } : {}),
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, dbMatch.id));
        result.matched++;
      } else {
        // Create new supplier from Holded
        await db.insert(suppliers).values({
          name: hs.name,
          phone: hs.phone || null,
          email: hs.email || null,
          holdedContactId: hs.id,
          contactName: hs.contactPersons?.[0]?.name || null,
          website: null,
          notes: null,
        });
        result.created++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Supplier "${hs.name}": ${msg}`);
    }
  }

  // 7. Sync units from Holded customFields → DB units
  // Holded stores Kenteken, Merk Caravan, Type Caravan, Lengte Caravan per contact
  const dbUnits = await db
    .select({ id: units.id, registration: units.registration, customerId: units.customerId })
    .from(units);
  const unitByRegCustomer = new Map<string, { id: string }>();
  const unitByReg = new Map<string, { id: string }>();
  for (const u of dbUnits) {
    if (u.registration) {
      const regNorm = u.registration.replace(/[\s-]/g, "").toUpperCase();
      unitByReg.set(regNorm, u);
      if (u.customerId) unitByRegCustomer.set(`${regNorm}:${u.customerId}`, u);
    }
  }

  // Re-fetch dbContacts to get their IDs after sync
  const dbContactsAfterSync = await db
    .select({ id: customers.id, holdedContactId: customers.holdedContactId })
    .from(customers);
  const customerByHoldedId = new Map<string, string>();
  for (const c of dbContactsAfterSync) {
    if (c.holdedContactId) customerByHoldedId.set(c.holdedContactId, c.id);
  }

  for (const hc of holdedClients) {
    try {
      if (!hc.customFields?.length) continue;

      const cf = (field: string) => {
        const f = hc.customFields?.find(f => f.field === field);
        return f?.value && String(f.value).trim() ? String(f.value).trim() : null;
      };

      const kenteken = cf("Kenteken");
      if (!kenteken) continue;

      const customerId = customerByHoldedId.get(hc.id);
      if (!customerId) continue;

      const regNorm = kenteken.replace(/[\s-]/g, "").toUpperCase();
      const existingByBoth = unitByRegCustomer.get(`${regNorm}:${customerId}`);
      const existingByReg = unitByReg.get(regNorm);
      const existing = existingByBoth ?? existingByReg;

      const brand = cf("Merk Caravan");
      const model = cf("Type Caravan");
      const length = cf("Lengte Caravan");
      const storageLocation = cf("Stalling");
      const storageType = cf("Stalling Type");
      const nfcTag = cf("NFC Tag");
      const checklist = cf("Checklist");
      const currentPosition = cf("Huidige Positie");
      const locatie = cf("Locatie");

      if (existing) {
        // Update brand/model and all custom fields from Holded
        await db
          .update(units)
          .set({
            ...(brand ? { brand } : {}),
            ...(model ? { model } : {}),
            ...(length ? { length } : {}),
            ...(storageLocation ? { storageLocation } : {}),
            ...(storageType ? { storageType } : {}),
            ...(nfcTag ? { nfcTag } : {}),
            ...(checklist ? { checklist } : {}),
            ...(currentPosition ? { currentPosition } : {}),
            ...(locatie ? { currentPosition: locatie } : {}),
            customerId,
            updatedAt: new Date(),
          })
          .where(eq(units.id, existing.id));
      } else {
        // Create new unit from Holded customFields
        const newUnit = await db.insert(units).values({
          registration: kenteken,
          brand: brand ?? null,
          model: model ?? null,
          length: length ?? null,
          unitType: "caravan",
          customerId,
          storageLocation: storageLocation ?? null,
          storageType: storageType ?? null,
          nfcTag: nfcTag ?? null,
          checklist: checklist ?? null,
          currentPosition: currentPosition ?? locatie ?? null,
          provisional: false,
        }).returning({ id: units.id });
        if (newUnit[0]) {
          const key = `${regNorm}:${customerId}`;
          unitByRegCustomer.set(key, newUnit[0]);
          unitByReg.set(regNorm, newUnit[0]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Unit for "${hc.name}": ${msg}`);
    }
  }

  return result;
}

// ─── Push a single customer to Holded ───
// Used when editing a contact in the app.
// Only pushes if there's meaningful data beyond just a name.

function hasRealContactData(customer: { name: string; email?: string | null; phone?: string | null; notes?: string | null }): boolean {
  return !!(customer.email || customer.phone || customer.notes);
}

export async function pushContactToHolded(customerId: string): Promise<void> {
  if (!isHoldedConfigured()) return;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return;

  // Don't push contacts that only have a name — no useful data for Holded
  if (!customer.holdedContactId && !hasRealContactData(customer)) return;

  // Get the customer's units to sync custom fields to Holded
  const customerUnits = await db
    .select()
    .from(units)
    .where(eq(units.customerId, customerId));
  const primaryUnit = customerUnits[0]; // Use first unit for custom fields

  // Build custom fields from unit data
  const customFields: Array<{ field: string; value: string }> = [];
  if (primaryUnit) {
    if (primaryUnit.registration) customFields.push({ field: "Kenteken", value: primaryUnit.registration });
    if (primaryUnit.brand) customFields.push({ field: "Merk Caravan", value: primaryUnit.brand });
    if (primaryUnit.model) customFields.push({ field: "Type Caravan", value: primaryUnit.model });
    if (primaryUnit.length) customFields.push({ field: "Lengte Caravan", value: primaryUnit.length });
    if (primaryUnit.storageLocation) customFields.push({ field: "Stalling", value: primaryUnit.storageLocation });
    if (primaryUnit.storageType) customFields.push({ field: "Stalling Type", value: primaryUnit.storageType });
    if (primaryUnit.nfcTag) customFields.push({ field: "NFC Tag", value: primaryUnit.nfcTag });
    if (primaryUnit.checklist) customFields.push({ field: "Checklist", value: primaryUnit.checklist });
    if (primaryUnit.currentPosition) customFields.push({ field: "Huidige Positie", value: primaryUnit.currentPosition });
  }

  if (customer.holdedContactId) {
    // Update existing Holded contact
    await updateHoldedContact(customer.holdedContactId, {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      isperson: customer.contactType === "person",
      vatnumber: customer.vatnumber,
      billAddress: (customer.address || customer.city || customer.postalCode) ? {
        address: customer.address ?? undefined,
        city: customer.city ?? undefined,
        postalCode: customer.postalCode ?? undefined,
        province: customer.province ?? undefined,
        country: customer.country ?? undefined,
      } : undefined,
      ...(customFields.length > 0 ? { customFields } : {}),
    });
    await db
      .update(customers)
      .set({ holdedSyncedAt: new Date() })
      .where(eq(customers.id, customerId));
  } else {
    // Create new contact in Holded & link
    const result = await createContact({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      isperson: customer.contactType === "person",
      type: "client",
      vatnumber: customer.vatnumber,
      billAddress: (customer.address || customer.city || customer.postalCode) ? {
        address: customer.address ?? undefined,
        city: customer.city ?? undefined,
        postalCode: customer.postalCode ?? undefined,
        province: customer.province ?? undefined,
        country: customer.country ?? undefined,
      } : undefined,
    });
    // Update with custom fields after creation
    if (customFields.length > 0) {
      try {
        await updateHoldedContact(result.id, { customFields });
      } catch { /* best effort */ }
    }
    await db
      .update(customers)
      .set({
        holdedContactId: result.id,
        holdedSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  }
}

// ─── Push a single supplier to Holded ───

export async function pushSupplierToHolded(supplierId: string): Promise<void> {
  if (!isHoldedConfigured()) return;

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) return;

  if (supplier.holdedContactId) {
    await updateHoldedContact(supplier.holdedContactId, {
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
    });
  } else {
    const result = await createContact({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      type: "supplier",
      isperson: false,
    });
    await db
      .update(suppliers)
      .set({ holdedContactId: result.id, updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId));
  }
}

// ─── Pull products from Holded → DB parts ───

export async function pullProducts(): Promise<SyncResult & { holdedTotal: number }> {
  if (!isHoldedConfigured()) throw new Error("Holded API not configured");

  const result: SyncResult & { holdedTotal: number } = {
    matched: 0, created: 0, updated: 0, skipped: 0, errors: [], holdedTotal: 0,
  };

  const holdedProducts = await listProducts();
  result.holdedTotal = holdedProducts.length;

  // Get existing parts
  const dbParts = await db
    .select({ id: parts.id, name: parts.name, partNumber: parts.partNumber, holdedProductId: parts.holdedProductId })
    .from(parts);

  const partByHoldedId = new Map<string, { id: string }>();
  const partBySku = new Map<string, { id: string }>();
  const partByName = new Map<string, { id: string }>();

  for (const p of dbParts) {
    if (p.holdedProductId) partByHoldedId.set(p.holdedProductId, p);
    if (p.partNumber) partBySku.set(p.partNumber.toLowerCase(), p);
    partByName.set(p.name.toLowerCase().trim(), p);
  }

  // Map Holded suppliers to DB suppliers for linking
  const dbSups = await db
    .select({ id: suppliers.id, holdedContactId: suppliers.holdedContactId })
    .from(suppliers)
    .where(isNotNull(suppliers.holdedContactId));
  const supplierByHoldedId = new Map<string, string>();
  for (const s of dbSups) {
    if (s.holdedContactId) supplierByHoldedId.set(s.holdedContactId, s.id);
  }

  for (const hp of holdedProducts) {
    try {
      const sku = hp.sku?.toLowerCase();
      const name = hp.name.toLowerCase().trim();

      let dbMatch = partByHoldedId.get(hp.id);
      if (!dbMatch && sku && partBySku.has(sku)) dbMatch = partBySku.get(sku);
      if (!dbMatch && partByName.has(name)) dbMatch = partByName.get(name);

      if (dbMatch) {
        // Update existing part
        await db
          .update(parts)
          .set({
            holdedProductId: hp.id,
            ...(hp.sku ? { partNumber: hp.sku } : {}),
            ...(hp.desc ? { description: hp.desc } : {}),
            ...(hp.cost != null && hp.cost > 0 ? { defaultCost: String(hp.cost) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(parts.id, dbMatch.id));
        result.matched++;
      } else {
        // Create new part from Holded
        const cost = hp.cost != null && hp.cost > 0 ? String(hp.cost) : null;
        await db.insert(parts).values({
          name: hp.name,
          partNumber: hp.sku || null,
          description: hp.desc || null,
          defaultCost: cost,
          holdedProductId: hp.id,
        });
        result.created++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Product "${hp.name}": ${msg}`);
    }
  }

  return result;
}

// ─── Get sync status overview ───

export async function getSyncStatus() {
  const [
    totalContacts,
    linkedContacts,
    totalSuppliers,
    linkedSuppliers,
    totalParts,
    linkedParts,
  ] = await Promise.all([
    db.select({ id: customers.id }).from(customers).then((r) => r.length),
    db.select({ id: customers.id }).from(customers).where(isNotNull(customers.holdedContactId)).then((r) => r.length),
    db.select({ id: suppliers.id }).from(suppliers).then((r) => r.length),
    db.select({ id: suppliers.id }).from(suppliers).where(isNotNull(suppliers.holdedContactId)).then((r) => r.length),
    db.select({ id: parts.id }).from(parts).then((r) => r.length),
    db.select({ id: parts.id }).from(parts).where(isNotNull(parts.holdedProductId)).then((r) => r.length),
  ]);

  return {
    contacts: { total: totalContacts, linked: linkedContacts },
    suppliers: { total: totalSuppliers, linked: linkedSuppliers },
    parts: { total: totalParts, linked: linkedParts },
  };
}
