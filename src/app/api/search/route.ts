export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { repairJobs, customers, units, locations } from "@/lib/db/schema";
import { or, ilike, isNull, eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;

  const [repairResults, customerResults, unitResults] = await Promise.all([
    db
      .select({
        id: repairJobs.id,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        status: repairJobs.status,
        priority: repairJobs.priority,
        customerName: customers.name,
        locationName: locations.name,
      })
      .from(repairJobs)
      .leftJoin(customers, eq(repairJobs.customerId, customers.id))
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .leftJoin(units, eq(repairJobs.unitId, units.id))
      .where(
        and(
          isNull(repairJobs.archivedAt),
          isNull(repairJobs.deletedAt),
          or(
            ilike(repairJobs.publicCode, pattern),
            ilike(repairJobs.title, pattern),
            ilike(repairJobs.descriptionRaw, pattern),
            ilike(repairJobs.bayReference, pattern),
            ilike(customers.name, pattern),
            ilike(units.registration, pattern)
          )
        )
      )
      .limit(8),

    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
      })
      .from(customers)
      .where(
        or(
          ilike(customers.name, pattern),
          ilike(customers.phone, pattern),
          ilike(customers.email, pattern)
        )
      )
      .limit(5),

    db
      .select({
        id: units.id,
        registration: units.registration,
        brand: units.brand,
        model: units.model,
        customerName: customers.name,
      })
      .from(units)
      .leftJoin(customers, eq(units.customerId, customers.id))
      .where(
        or(
          ilike(units.registration, pattern),
          ilike(units.brand, pattern),
          ilike(units.model, pattern),
          ilike(units.internalNumber, pattern)
        )
      )
      .limit(5),
  ]);

  const results = [
    ...repairResults.map((r) => ({
      type: "repair" as const,
      id: r.id,
      title: r.publicCode
        ? `${r.publicCode} — ${r.title || "Untitled"}`
        : r.title || "Untitled Repair",
      subtitle: [r.customerName, r.locationName].filter(Boolean).join(" · "),
      status: r.status,
      priority: r.priority,
    })),
    ...customerResults.map((c) => ({
      type: "customer" as const,
      id: c.id,
      title: c.name,
      subtitle: [c.phone, c.email].filter(Boolean).join(" · ") || "No contact info",
    })),
    ...unitResults.map((u) => ({
      type: "unit" as const,
      id: u.id,
      title: [u.brand, u.model].filter(Boolean).join(" ") || u.registration || "Unknown Unit",
      subtitle: [u.registration, u.customerName].filter(Boolean).join(" · "),
    })),
  ];

  return NextResponse.json({ results });
}
