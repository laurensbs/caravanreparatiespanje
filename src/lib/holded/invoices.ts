import { holdedFetch, holdedFetchRaw, holdedFetchAll } from "./client";

// ─── Types ───

export interface HoldedContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  type?: string; // "client", "supplier", "debtor", "creditor", "lead", ""
  isperson?: boolean;
  code?: string;
  vatnumber?: string;
  tradeName?: string;
  billAddress?: {
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    countryCode?: string;
  };
  shippingAddresses?: Array<{
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    countryCode?: string;
  }>;
  defaults?: {
    salesChannel?: string;
    paymentMethod?: string;
  };
  socialNetworks?: Record<string, string>;
  tags?: string[];
  customFields?: Array<{ field: string; value: string }>;
  contactPersons?: Array<{
    name?: string;
    job?: string;
    phone?: string;
    email?: string;
  }>;
  note?: string;
  groupId?: string;
  iban?: string;
  swift?: string;
  clientRecord?: number;
  supplierRecord?: number;
}

export interface HoldedInvoice {
  id: string;
  docNumber: string;
  contact: string;
  contactName: string;
  date: number;
  dueDate?: number;
  total: number;
  subtotal: number;
  status: number; // 0 = not paid, 1 = paid, 2 = partially paid
  currency: string;
  desc?: string;
  items?: Array<{
    name: string;
    desc?: string;
    units: number;
    subtotal: number;
    tax: number;
  }>;
}

// ─── Contact Operations ───

export async function getContact(contactId: string): Promise<HoldedContact> {
  return holdedFetch<HoldedContact>(`/contacts/${contactId}`);
}

export async function listContacts(): Promise<HoldedContact[]> {
  return holdedFetchAll<HoldedContact>("/contacts");
}

export async function createContact(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  isperson?: boolean;
  type?: string;
  vatnumber?: string | null;
  tradeName?: string | null;
  billAddress?: {
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    countryCode?: string;
  };
}): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: data.name,
    type: data.type ?? "client",
  };
  if (data.email) body.email = data.email;
  if (data.phone) body.phone = data.phone;
  if (data.isperson !== undefined) body.isperson = data.isperson;
  if (data.vatnumber) body.vatnumber = data.vatnumber;
  if (data.tradeName) body.tradeName = data.tradeName;
  if (data.billAddress) body.billAddress = data.billAddress;
  return holdedFetch<{ id: string }>("/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateContact(
  contactId: string,
  data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    isperson?: boolean;
    vatnumber?: string | null;
    tradeName?: string | null;
    billAddress?: {
      address?: string;
      city?: string;
      postalCode?: string;
      province?: string;
      country?: string;
      countryCode?: string;
    };
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.email !== undefined) body.email = data.email ?? undefined;
  if (data.phone !== undefined) body.phone = data.phone ?? undefined;
  if (data.isperson !== undefined) body.isperson = data.isperson;
  if (data.vatnumber !== undefined) body.vatnumber = data.vatnumber ?? undefined;
  if (data.tradeName !== undefined) body.tradeName = data.tradeName ?? undefined;
  if (data.billAddress) body.billAddress = data.billAddress;
  await holdedFetch(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function findOrCreateContact(customer: {
  name: string;
  email?: string | null;
  phone?: string | null;
  holdedContactId?: string | null;
}): Promise<string> {
  if (customer.holdedContactId) return customer.holdedContactId;
  const result = await createContact(customer);
  return result.id;
}

// ─── Invoice Operations ───

export async function listInvoicesByContact(
  contactId: string,
): Promise<HoldedInvoice[]> {
  return holdedFetch<HoldedInvoice[]>(
    `/documents/invoice?contactid=${contactId}`,
  );
}

export async function listAllInvoices(): Promise<HoldedInvoice[]> {
  return holdedFetchAll<HoldedInvoice>("/documents/invoice");
}

export async function getInvoice(invoiceId: string): Promise<HoldedInvoice> {
  return holdedFetch<HoldedInvoice>(`/documents/invoice/${invoiceId}`);
}

interface CreateInvoiceParams {
  contactId: string;
  description: string;
  items: Array<{
    name: string;
    desc?: string;
    units: number;
    subtotal: number;
    tax?: number;
  }>;
  notes?: string;
}

export async function createInvoice(
  params: CreateInvoiceParams,
): Promise<{ id: string; docNumber: string }> {
  return holdedFetch<{ id: string; docNumber: string }>(
    "/documents/invoice",
    {
      method: "POST",
      body: JSON.stringify({
        contactId: params.contactId,
        desc: params.description,
        date: Math.floor(Date.now() / 1000),
        notes: params.notes,
        items: params.items.map((item) => ({
          name: item.name,
          desc: item.desc,
          units: item.units,
          subtotal: item.subtotal,
          tax: item.tax ?? 21,
        })),
      }),
    },
  );
}

export async function getInvoicePdf(invoiceId: string): Promise<ArrayBuffer> {
  const res = await holdedFetchRaw(
    `/documents/invoice/${invoiceId}/pdf`,
    { headers: { accept: "application/pdf" } },
  );
  if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function sendInvoice(
  invoiceId: string,
  emails: string[],
): Promise<void> {
  await holdedFetch(`/documents/invoice/${invoiceId}/send`, {
    method: "POST",
    body: JSON.stringify({ emails }),
  });
}

// ─── Quote (Estimate) Operations ───

interface CreateQuoteParams {
  contactId: string;
  description: string;
  items: Array<{
    name: string;
    desc?: string;
    units: number;
    subtotal: number;
    tax?: number;
    discount?: number;
  }>;
  notes?: string;
}

export async function createQuote(
  params: CreateQuoteParams,
): Promise<{ id: string; docNumber: string }> {
  return holdedFetch<{ id: string; docNumber: string }>(
    "/documents/estimate",
    {
      method: "POST",
      body: JSON.stringify({
        contactId: params.contactId,
        desc: params.description,
        date: Math.floor(Date.now() / 1000),
        notes: params.notes,
        items: params.items.map((item) => ({
          name: item.name,
          desc: item.desc,
          units: item.units,
          subtotal: item.subtotal,
          tax: item.tax ?? 21,
          discount: item.discount ?? 0,
        })),
      }),
    },
  );
}

export async function getQuotePdf(quoteId: string): Promise<ArrayBuffer> {
  const res = await holdedFetchRaw(
    `/documents/estimate/${quoteId}/pdf`,
    { headers: { accept: "application/pdf" } },
  );
  if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function sendQuote(
  quoteId: string,
  emails: string[],
): Promise<void> {
  await holdedFetch(`/documents/estimate/${quoteId}/send`, {
    method: "POST",
    body: JSON.stringify({ emails }),
  });
}

// ─── Product Operations ───

export interface HoldedProduct {
  id: string;
  name: string;
  desc?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  tax?: number;
  cost?: number;
  purchasePrice?: number;
  stock?: number;
  kind?: string; // "simple", "variants", "lots", "pack"
  tags?: string[];
  weight?: number;
}

export async function listProducts(): Promise<HoldedProduct[]> {
  return holdedFetchAll<HoldedProduct>("/products");
}

export async function getProduct(productId: string): Promise<HoldedProduct> {
  return holdedFetch<HoldedProduct>(`/products/${productId}`);
}

export async function deleteContact(contactId: string): Promise<void> {
  await holdedFetch(`/contacts/${contactId}`, { method: "DELETE" });
}
