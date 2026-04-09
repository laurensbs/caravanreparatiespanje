import { getUnitById } from "@/actions/units";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hash, Truck, Calendar, User, Wrench, StickyNote, MapPin, Ruler, Warehouse, Navigation, Tag } from "lucide-react";
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
          <Link href="/units"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            {[unit.brand, unit.model].filter(Boolean).join(" ") || "Unit"}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {unit.registration && <span className="font-mono">{unit.registration}</span>}
            {unit.customer && (
              <>
                <span>·</span>
                <Link href={`/customers/${unit.customer.id}`} className="text-primary hover:underline">{unit.customer.name}</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Details */}
        <Card>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Hash className="h-3.5 w-3.5" /> Registration</span>
                <span className="font-mono font-medium">{unit.registration ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Truck className="h-3.5 w-3.5" /> Brand</span>
                <span className="font-medium">{unit.brand ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Truck className="h-3.5 w-3.5" /> Model</span>
                <span className="font-medium">{unit.model ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Year</span>
                <span className="font-medium">{unit.year ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Hash className="h-3.5 w-3.5" /> Chassis</span>
                <span className="font-mono text-xs">{unit.chassisId ?? "—"}</span>
              </div>
              {unit.length && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground"><Ruler className="h-3.5 w-3.5" /> Length</span>
                  <span className="font-medium">{unit.length}m</span>
                </div>
              )}
              {unit.customer && (
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /> Owner</span>
                  <Link href={`/customers/${unit.customer.id}`} className="font-medium text-primary hover:underline">{unit.customer.name}</Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Storage & Location */}
        {(unit.storageLocation || unit.storageType || unit.currentPosition || unit.nfcTag) && (
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Storage & Location</p>
              </div>
              <div className="space-y-3 text-sm">
                {unit.storageLocation && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Storage</span>
                    <span className="font-medium">{unit.storageLocation}</span>
                  </div>
                )}
                {unit.storageType && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground"><Warehouse className="h-3.5 w-3.5" /> Type</span>
                    <span className="font-medium">{unit.storageType}</span>
                  </div>
                )}
                {unit.currentPosition && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground"><Navigation className="h-3.5 w-3.5" /> Current Position</span>
                    <span className="font-medium">{unit.currentPosition}</span>
                  </div>
                )}
                {unit.nfcTag && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground"><Tag className="h-3.5 w-3.5" /> NFC Tag</span>
                    <span className="font-mono text-xs">{unit.nfcTag}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {unit.notes && (
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
              </div>
              <p className="text-sm whitespace-pre-wrap">{unit.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Repairs */}
        <Card className={!unit.notes ? "lg:col-span-2" : ""}>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Repairs ({unit.repairJobs.length})</p>
            </div>
            {unit.repairJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No repairs for this unit</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {unit.repairJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
                  >
                    <div className="min-w-0 mr-2">
                      <p className="font-medium text-[13px] truncate">{job.title || "Unnamed"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{job.publicCode}</p>
                    </div>
                    <Badge variant="secondary" className={`${STATUS_COLORS[job.status as RepairStatus]} rounded-full text-[10px] px-2 py-0 shrink-0`}>
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
