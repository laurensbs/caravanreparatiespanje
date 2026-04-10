import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { repairJobs, customers, locations } from "@/lib/db/schema";
import { eq, and, like, sql, isNull } from "drizzle-orm";
import { createAuditLog } from "@/actions/audit";
import type { RepairStatus } from "@/types";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as RepairStatus | null;
  const locationId = searchParams.get("locationId");
  const search = searchParams.get("q");

  const conditions = [isNull(repairJobs.deletedAt)];
  if (status) conditions.push(eq(repairJobs.status, status));
  if (locationId) conditions.push(eq(repairJobs.locationId, locationId));
  if (search) conditions.push(like(repairJobs.title, `%${search}%`));

  const where = and(...conditions);

  const jobs = await db
    .select({
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      priority: repairJobs.priority,
      customerResponseStatus: repairJobs.customerResponseStatus,
      invoiceStatus: repairJobs.invoiceStatus,
      descriptionRaw: repairJobs.descriptionRaw,
      descriptionNormalized: repairJobs.descriptionNormalized,
      partsNeededRaw: repairJobs.partsNeededRaw,
      notesRaw: repairJobs.notesRaw,
      createdAt: repairJobs.createdAt,
      updatedAt: repairJobs.updatedAt,
      customerName: customers.name,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      locationName: locations.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(locations, eq(repairJobs.locationId, locations.id))
    .where(where)
    .orderBy(repairJobs.createdAt);

  // Build CSV
  const headers = [
    "Reference",
    "Title",
    "Status",
    "Priority",
    "Customer Response",
    "Invoice Status",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Location",
    "Issue Description",
    "Issue Summary",
    "Parts Needed",
    "Notes",
    "Created",
    "Updated",
  ];

  const rows = jobs.map((j) => [
    j.publicCode,
    j.title,
    j.status,
    j.priority,
    j.customerResponseStatus,
    j.invoiceStatus,
    j.customerName ?? "",
    j.customerEmail ?? "",
    j.customerPhone ?? "",
    j.locationName ?? "",
    j.descriptionRaw ?? "",
    j.descriptionNormalized ?? "",
    j.partsNeededRaw ?? "",
    j.notesRaw ?? "",
    j.createdAt ? new Date(j.createdAt).toISOString() : "",
    j.updatedAt ? new Date(j.updatedAt).toISOString() : "",
  ]);

  const escapeCsv = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsv(String(cell))).join(",")),
  ].join("\n");

  await createAuditLog("export", "repair_job", "bulk", {
    filters: { status, locationId, search },
    count: jobs.length,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="repairs-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
