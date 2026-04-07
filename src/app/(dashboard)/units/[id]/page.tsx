import { getUnitById } from "@/actions/units";
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

export default async function UnitDetailPage({ params }: Props) {
  const { id } = await params;
  const unit = await getUnitById(id);
  if (!unit) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/units"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {[unit.brand, unit.model, unit.registration].filter(Boolean).join(" · ") || "Unit"}
          </h1>
          {unit.customer && (
            <p className="text-muted-foreground">
              Owner: <Link href={`/customers/${unit.customer.id}`} className="hover:underline">{unit.customer.name}</Link>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Registration:</span> {unit.registration ?? "—"}</div>
            <div><span className="text-muted-foreground">Brand:</span> {unit.brand ?? "—"}</div>
            <div><span className="text-muted-foreground">Model:</span> {unit.model ?? "—"}</div>
            <div><span className="text-muted-foreground">Year:</span> {unit.year ?? "—"}</div>
            <div><span className="text-muted-foreground">Chassis ID:</span> {unit.chassisId ?? "—"}</div>
            {unit.notes && <div><span className="text-muted-foreground">Notes:</span><p className="mt-1 whitespace-pre-wrap">{unit.notes}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Repair History ({unit.repairJobs.length})</CardTitle></CardHeader>
          <CardContent>
            {unit.repairJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repairs for this unit</p>
            ) : (
              <div className="space-y-2">
                {unit.repairJobs.map((job) => (
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
