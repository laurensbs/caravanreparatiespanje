import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, units } from "@/lib/db/schema";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllQuotes, type HoldedQuote } from "@/lib/holded/invoices";
import { filterRepairQuotes } from "@/lib/holded/filter";

export const dynamic = "force-dynamic";

function quoteSearchText(q: HoldedQuote): string {
  return [
    q.desc ?? "",
    q.docNumber ?? "",
    ...(q.products ?? []).map((p) => `${p.name ?? ""} ${p.desc ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ message: "Holded not configured" });
  }

  const stats = { discovered: 0, errors: 0, quotesTotal: 0 };

  try {
    const rawQuotes = await listAllQuotes();
    const holdedQuotes = filterRepairQuotes(rawQuotes);
    stats.quotesTotal = holdedQuotes.length;

    const allRepairs = await db
      .select({
        id: repairJobs.id,
        customerId: repairJobs.customerId,
        holdedQuoteId: repairJobs.holdedQuoteId,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        createdAt: repairJobs.createdAt,
        completedAt: repairJobs.completedAt,
        registration: units.registration,
      })
      .from(repairJobs)
      .leftJoin(units, eq(repairJobs.unitId, units.id))
      .where(isNull(repairJobs.deletedAt));

    const allCustomers = await db
      .select({ id: customers.id, holdedContactId: customers.holdedContactId })
      .from(customers)
      .where(isNotNull(customers.holdedContactId));

    const customerByHoldedId = new Map<string, string>();
    for (const c of allCustomers) {
      if (c.holdedContactId) customerByHoldedId.set(c.holdedContactId, c.id);
    }

    const repairsByCustomer = new Map<string, typeof allRepairs>();
    for (const r of allRepairs) {
      if (!r.customerId) continue;
      const list = repairsByCustomer.get(r.customerId) ?? [];
      list.push(r);
      repairsByCustomer.set(r.customerId, list);
    }

    const repairByQuoteId = new Map<string, (typeof allRepairs)[0]>();
    for (const r of allRepairs) {
      if (r.holdedQuoteId) repairByQuoteId.set(r.holdedQuoteId, r);
    }

    for (const q of holdedQuotes) {
      try {
        if (repairByQuoteId.has(q.id)) continue;

        const customerId = customerByHoldedId.get(q.contact);
        if (!customerId) continue;

        const customerRepairs = repairsByCustomer.get(customerId);
        if (!customerRepairs) continue;

        const unlinked = customerRepairs.filter((r) => !r.holdedQuoteId);
        if (unlinked.length === 0) continue;

        const qText = quoteSearchText(q);

        let matched = unlinked.find((r) => r.publicCode && qText.includes(r.publicCode.toLowerCase()));

        if (!matched) {
          const reg = unlinked.map((r) => r.registration?.trim()).filter(Boolean) as string[];
          matched = unlinked.find((r) => {
            const regNorm = r.registration?.trim().toLowerCase();
            return regNorm && regNorm.length >= 3 && qText.includes(regNorm);
          });
        }

        if (!matched) {
          matched = unlinked.find(
            (r) => r.title && r.title.length > 3 && qText.includes(r.title.toLowerCase()),
          );
        }

        if (!matched) {
          const qDate = q.date * 1000;
          let best: (typeof unlinked)[0] | null = null;
          let bestDist = Infinity;
          for (const r of unlinked) {
            const repairDate = (r.completedAt ?? r.createdAt).getTime();
            const dist = Math.abs(qDate - repairDate);
            if (dist < bestDist) {
              bestDist = dist;
              best = r;
            }
          }
          if (best && bestDist < 90 * 24 * 60 * 60 * 1000) {
            matched = best;
          }
        }

        if (!matched) continue;

        await db
          .update(repairJobs)
          .set({
            holdedQuoteId: q.id,
            holdedQuoteNum: q.docNumber,
            holdedQuoteDate: q.date ? new Date(q.date * 1000) : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(repairJobs.id, matched.id));

        await db.insert(repairJobEvents).values({
          repairJobId: matched.id,
          eventType: "quote_discovered",
          fieldChanged: "holdedQuoteId",
          oldValue: "",
          newValue: q.docNumber ?? q.id,
          comment: `Quote ${q.docNumber ?? q.id} linked from Holded sync`,
        });

        matched.holdedQuoteId = q.id;
        repairByQuoteId.set(q.id, matched);
        stats.discovered++;
      } catch {
        stats.errors++;
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
}
