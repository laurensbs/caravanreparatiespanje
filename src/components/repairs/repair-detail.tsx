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
import { ArrowLeft, Save, Clock, User, MapPin, FileText, Pencil, X as XIcon, MessageSquare, StickyNote } from "lucide-react";
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
            <Link href={backTo ?? "/repairs"}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{job.publicCode ?? "Repair Job"}</h1>
              <Badge className={STATUS_COLORS[status as RepairStatus]}>
                {STATUS_LABELS[status as RepairStatus]}
              </Badge>
              <Badge className={PRIORITY_COLORS[priority as Priority]}>
                {PRIORITY_LABELS[priority as Priority]}
              </Badge>
            </div>
            {editingTitle ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm h-8"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingTitle(false); }}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTitle(false)}>
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                <span>{title || "No title"}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-lg">
          {saving ? <Spinner className="mr-2" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-5 lg:col-span-2">
          {/* Issue description */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Issue Description
                </span>
                {!editingDescription && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingDescription(true)} className="h-7 text-xs">
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    autoFocus
                  />
                  <Button variant="ghost" size="sm" onClick={() => setEditingDescription(false)} className="text-xs">
                    Done
                  </Button>
                </div>
              ) : (
                <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">
                  {description || "No description"}
                </div>
              )}
              {job.descriptionNormalized && (
                <>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">Normalized Summary</p>
                  <p className="text-sm">{job.descriptionNormalized}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Parts needed */}
          {job.partsNeededRaw && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Parts Needed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{job.partsNeededRaw}</div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <StickyNote className="h-4 w-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes visible to all team members..."
                  className="rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Internal only</Label>
                <Textarea
                  value={internalComments}
                  onChange={(e) => setInternalComments(e.target.value)}
                  rows={2}
                  placeholder="Private staff notes..."
                  className="mt-1 rounded-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded</p>
              ) : (
                <div className="space-y-0">
                  {job.events.map((event: any, idx: number) => (
                    <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {idx < job.events.length - 1 && (
                        <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                      )}
                      <div className="relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-primary/30 bg-background" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className="font-medium">{event.userName ?? "System"}</span>
                          <span className="text-muted-foreground capitalize">{event.eventType.replace(/_/g, " ")}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                            <SmartDate date={event.createdAt} />
                          </span>
                        </div>
                        {event.fieldChanged && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <strong>{event.fieldChanged}</strong>: {event.oldValue} → {event.newValue}
                          </p>
                        )}
                        {event.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication Log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                Communication Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommunicationLogPanel
                repairJobId={job.id}
                logs={communicationLogs}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status & Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <PrioritySelect value={priority} onValueChange={setPriority} className="mt-1" />
              </div>
              <div>
                <Label>Invoice Status</Label>
                <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVOICE_STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer Response</Label>
                <Select value={customerResponseStatus} onValueChange={setCustomerResponseStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{job.location?.name ?? "No location"}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{job.customer?.name ?? "No customer"}</span>
              </div>
              {job.unit && (
                <div>
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p>{[job.unit.brand, job.unit.model, job.unit.registration].filter(Boolean).join(" · ") || "—"}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Assigned</p>
                <p>{job.assignedUser?.name ?? "Unassigned"}</p>
              </div>
              {job.sourceSheet && (
                <div>
                  <p className="text-xs text-muted-foreground">Source Sheet</p>
                  <p>{job.sourceSheet}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Created {format(new Date(job.createdAt), "dd MMM yyyy")}</span>
              </div>
              {job.estimatedCost && (
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Cost</p>
                  <p>€{job.estimatedCost}</p>
                </div>
              )}
              {job.actualCost && (
                <div>
                  <p className="text-xs text-muted-foreground">Actual Cost</p>
                  <p>€{job.actualCost}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Normalized Flags */}
          {(job.waterDamageRiskFlag || job.safetyFlag || job.tyresFlag || job.lightsFlag || job.brakesFlag || job.windowsFlag || job.sealsFlag || job.partsRequiredFlag || job.followUpRequiredFlag || job.warrantyInternalCostFlag || job.prepaidFlag) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Flags</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {job.waterDamageRiskFlag && <Badge variant="destructive">Water Damage Risk</Badge>}
                {job.safetyFlag && <Badge variant="destructive">Safety Concern</Badge>}
                {job.tyresFlag && <Badge variant="secondary">Tyres</Badge>}
                {job.lightsFlag && <Badge variant="secondary">Lighting</Badge>}
                {job.brakesFlag && <Badge variant="secondary">Brakes</Badge>}
                {job.windowsFlag && <Badge variant="secondary">Windows</Badge>}
                {job.sealsFlag && <Badge variant="secondary">Seals</Badge>}
                {job.partsRequiredFlag && <Badge variant="outline">Parts Required</Badge>}
                {job.followUpRequiredFlag && <Badge variant="outline">Follow-up</Badge>}
                {job.warrantyInternalCostFlag && <Badge variant="outline">Warranty/Internal</Badge>}
                {job.prepaidFlag && <Badge variant="outline">Prepaid</Badge>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
