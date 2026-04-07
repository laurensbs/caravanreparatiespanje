import { getCustomerById } from "@/actions/customers";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/customers"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">
            {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Phone:</span> {customer.phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Email:</span> {customer.email ?? "—"}</div>
            {customer.notes && (
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <p className="mt-1 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {customer.units.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Units ({customer.units.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customer.units.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/units/${unit.id}`}
                    className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50"
                  >
                    <div>
                      {unit.registration && (
                        <span className="font-mono text-xs text-muted-foreground">{unit.registration}</span>
                      )}
                      <p className="truncate">{[unit.brand, unit.model].filter(Boolean).join(" ") || "Unknown unit"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={customer.units.length > 0 ? "lg:col-span-2" : ""}>
          <CardHeader><CardTitle className="text-base">Repair Jobs ({customer.repairJobs.length})</CardTitle></CardHeader>
          <CardContent>
            {customer.repairJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repair jobs linked</p>
            ) : (
              <div className="space-y-2">
                {customer.repairJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50"
                  >
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{job.publicCode}</span>
                      <p className="truncate">{job.title || "Unnamed"}</p>
                    </div>
                    <Badge variant="secondary" className={STATUS_COLORS[job.status as RepairStatus]}>
                      {STATUS_LABELS[job.status as RepairStatus]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
