"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRepairJob } from "@/actions/repairs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  CUSTOMER_RESPONSE_LABELS, INVOICE_STATUS_LABELS,
} from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus, InvoiceStatus } from "@/types";
import { ArrowLeft, Save, Clock, User, MapPin, FileText, Pencil, X as XIcon, MessageSquare, StickyNote, Wrench, Hash, CalendarDays, DollarSign, Flag } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SmartDate } from "@/components/ui/smart-date";
import { CommunicationLogPanel } from "@/components/communication-log";
import { toast } from "sonner";
import { PrioritySelect } from "@/components/repairs/priority-select";

interface RepairDetailProps {
  job: any; // Full job with relations from getRepairJobById
  communicationLogs?: any[];
  backTo?: string;
}

export function RepairDetail({ job, communicationLogs = [], backTo }: RepairDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(job.status);
  const [priority, setPriority] = useState(job.priority);
  const [invoiceStatus, setInvoiceStatus] = useState(job.invoiceStatus);
  const [customerResponseStatus, setCustomerResponseStatus] = useState(job.customerResponseStatus);
  const [notes, setNotes] = useState(job.notesRaw && job.notesRaw !== "true" && job.notesRaw !== "false" ? job.notesRaw : "");
  const [internalComments, setInternalComments] = useState(job.internalComments ?? "");
  const [title, setTitle] = useState(job.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(job.descriptionRaw ?? "");
  const [editingDescription, setEditingDescription] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateRepairJob(job.id, {
        title: title || null,
        descriptionRaw: description || null,
        status,
        priority,
        invoiceStatus,
        customerResponseStatus,
        notesRaw: notes || null,
        internalComments: internalComments || null,
      });
      router.refresh();
      toast.success("Changes saved");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0 mt-0.5" asChild>
            <Link href={backTo ?? "/repairs"}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight">{job.publicCode ?? "Repair Job"}</h1>
              <Badge className={`${STATUS_COLORS[status as RepairStatus]} rounded-full text-[11px] px-2 py-0`}>
                {STATUS_LABELS[status as RepairStatus]}
              </Badge>
              <Badge className={`${PRIORITY_COLORS[priority as Priority]} rounded-full text-[11px] px-2 py-0`}>
                {PRIORITY_LABELS[priority as Priority]}
              </Badge>
            </div>
            {editingTitle ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm h-7 rounded-lg"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingTitle(false); if (e.key === "Enter") setEditingTitle(false); }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTitle(false)}>
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-left mt-0.5"
              >
                <span className="truncate">{title || "No title — click to add"}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-lg shrink-0">
          {saving ? <Spinner className="mr-2" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 lg:col-span-2">
          {/* Issue description */}
          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Description
                </span>
                {!editingDescription && (
                  <button type="button" onClick={() => setEditingDescription(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    autoFocus
                    className="rounded-lg text-sm"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setEditingDescription(false)} className="h-7 text-xs">
                    Done
                  </Button>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {description || <span className="text-muted-foreground italic">No description</span>}
                </div>
              )}
              {job.descriptionNormalized && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground">{job.descriptionNormalized}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts needed */}
          {job.partsNeededRaw && (
            <Card>
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />
                  Parts Needed
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="whitespace-pre-wrap text-sm">{job.partsNeededRaw}</div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <StickyNote className="h-3.5 w-3.5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3 space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add notes visible to all team members..."
                className="rounded-lg text-sm resize-none"
              />
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Internal only</p>
                <Textarea
                  value={internalComments}
                  onChange={(e) => setInternalComments(e.target.value)}
                  rows={2}
                  placeholder="Private staff notes..."
                  className="rounded-lg text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {job.events.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="space-y-0">
                  {job.events.map((event: any, idx: number) => (
                    <div key={event.id} className="relative flex gap-3 pb-3 last:pb-0">
                      {idx < job.events.length - 1 && (
                        <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-border" />
                      )}
                      <div className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-primary/30 bg-background" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 text-xs">
                          <span className="font-medium">{event.userName ?? "System"}</span>
                          <span className="text-muted-foreground">{event.eventType.replace(/_/g, " ")}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground/70 whitespace-nowrap">
                            <SmartDate date={event.createdAt} />
                          </span>
                        </div>
                        {event.fieldChanged && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {event.fieldChanged}: {event.oldValue} → {event.newValue}
                          </p>
                        )}
                        {event.comment && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{event.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Communication Log */}
          <Card>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Communication Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-3">
              <CommunicationLogPanel
                repairJobId={job.id}
                logs={communicationLogs}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status controls */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Priority</Label>
                  <PrioritySelect value={priority} onValueChange={setPriority} className="mt-1 h-8 text-xs rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Invoice</Label>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Customer</Label>
                  <Select value={customerResponseStatus} onValueChange={setCustomerResponseStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </span>
                  <span className="font-medium text-right">{job.location?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Customer
                  </span>
                  {job.customer ? (
                    <Link href={`/customers/${job.customer.id}`} className="font-medium text-primary hover:underline text-right">
                      {job.customer.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {job.unit && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Unit
                    </span>
                    <Link href={`/units/${job.unit.id}`} className="font-medium text-primary hover:underline text-right truncate max-w-[160px]">
                      {[job.unit.brand, job.unit.model, job.unit.registration].filter(Boolean).join(" · ") || "—"}
                    </Link>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Assigned
                  </span>
                  <span className="font-medium text-right">{job.assignedUser?.name ?? "Unassigned"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Created
                  </span>
                  <span className="text-right">{format(new Date(job.createdAt), "dd MMM yyyy")}</span>
                </div>
                {(job.estimatedCost || job.actualCost) && (
                  <div className="border-t pt-2.5 mt-2.5 space-y-2.5">
                    {job.estimatedCost && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          Estimated
                        </span>
                        <span className="font-medium">€{job.estimatedCost}</span>
                      </div>
                    )}
                    {job.actualCost && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          Actual
                        </span>
                        <span className="font-medium">€{job.actualCost}</span>
                      </div>
                    )}
                  </div>
                )}
                {job.sourceSheet && (
                  <div className="border-t pt-2.5 mt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Source</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{job.sourceSheet}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Flags */}
          {(job.waterDamageRiskFlag || job.safetyFlag || job.tyresFlag || job.lightsFlag || job.brakesFlag || job.windowsFlag || job.sealsFlag || job.partsRequiredFlag || job.followUpRequiredFlag || job.warrantyInternalCostFlag || job.prepaidFlag) && (
            <Card>
              <CardContent className="p-4">
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
                  <Flag className="h-3 w-3" />
                  Flags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.waterDamageRiskFlag && <Badge variant="destructive" className="rounded-full text-[10px] px-2 py-0">Water Damage</Badge>}
                  {job.safetyFlag && <Badge variant="destructive" className="rounded-full text-[10px] px-2 py-0">Safety</Badge>}
                  {job.tyresFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Tyres</Badge>}
                  {job.lightsFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Lighting</Badge>}
                  {job.brakesFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Brakes</Badge>}
                  {job.windowsFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Windows</Badge>}
                  {job.sealsFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Seals</Badge>}
                  {job.partsRequiredFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Parts</Badge>}
                  {job.followUpRequiredFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Follow-up</Badge>}
                  {job.warrantyInternalCostFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Warranty</Badge>}
                  {job.prepaidFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Prepaid</Badge>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
