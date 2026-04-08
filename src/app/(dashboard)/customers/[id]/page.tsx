import { getCustomerById } from "@/actions/customers";
import { getCustomerHoldedInvoices } from "@/actions/holded";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Mail, StickyNote, Wrench, Truck, Receipt, ExternalLink } from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const [customer, holdedInvoices] = await Promise.all([
    getCustomerById(id),
    getCustomerHoldedInvoices(id),
  ]);
  if (!customer) notFound();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
          <Link href="/customers"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contact info */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Phone className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{customer.phone ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{customer.email ?? "—"}</p>
              </div>
            </div>
            {customer.notes && (
              <div className="flex items-start gap-2.5 pt-2 border-t">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                  <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-sm whitespace-pre-wrap pt-1">{customer.notes}</p>
              </div>
            )}
            {customer.holdedContactId && (
              <div className="pt-2 border-t">
                <a
                  href={`https://app.holded.com/contacts/${customer.holdedContactId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  View in Holded
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Units */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Units ({customer.units.length})</p>
            </div>
            {customer.units.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No units linked</p>
            ) : (
              <div className="space-y-1.5">
                {customer.units.map((unit) => (
                  <Link
                    key={unit.id}
                    href={`/units/${unit.id}`}
                    className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[13px] truncate">
                        {[unit.brand, unit.model].filter(Boolean).join(" ") || "Unknown unit"}
                      </p>
                      {unit.registration && (
                        <p className="font-mono text-[11px] text-muted-foreground">{unit.registration}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repairs */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Repairs ({customer.repairJobs.length})</p>
            </div>
            {customer.repairJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No repair jobs linked</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {customer.repairJobs.map((job) => (
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

      {/* Holded Invoices - full width */}
      {holdedInvoices.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoices ({holdedInvoices.length})</p>
            </div>
            <div className="space-y-1.5">
              {holdedInvoices.map((inv) => (
                <a
                  key={inv.id}
                  href={`https://app.holded.com/documents/invoice/${inv.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="min-w-0 mr-2">
                    <p className="font-medium text-[13px]">{inv.invoiceNum}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {inv.desc || "No description"}
                      {inv.date && ` · ${new Date(inv.date * 1000).toLocaleDateString("nl-NL")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium tabular-nums">€{inv.total?.toFixed(2) ?? "0.00"}</span>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-[10px] px-2 py-0 ${
                        inv.status === 1
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                          : inv.status === 2
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400"
                      }`}
                    >
                      {inv.status === 1 ? "Paid" : inv.status === 2 ? "Partial" : "Unpaid"}
                    </Badge>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
