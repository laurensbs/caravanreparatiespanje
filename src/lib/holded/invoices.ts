import { holdedFetch, holdedFetchRaw } from "./client";

// ─── Types ───

export interface HoldedContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  type?: string;
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
  defaults?: {
    salesChannel?: string;
    paymentMethod?: string;
  };
  socialNetworks?: Record<string, string>;
  tags?: string[];
  customFields?: Array<{ field: string; value: string }>;
}

export interface HoldedInvoice {
  id: string;
  invoiceNum: string;
  contactId: string;
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
  return holdedFetch<HoldedContact[]>("/contacts");
}

export async function createContact(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<{ id: string }> {
  return holdedFetch<{ id: string }>("/contacts", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      type: "client",
    }),
  });
}

export async function updateContact(
  contactId: string,
  data: { name: string; email?: string | null; phone?: string | null },
): Promise<void> {
  await holdedFetch(`/contacts/${contactId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
    }),
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
): Promise<{ id: string; invoiceNum: string }> {
  return holdedFetch<{ id: string; invoiceNum: string }>(
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
