"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer, getCustomerById } from "@/actions/customers";
import { getCustomerHoldedInvoices, getCustomerHoldedQuotes } from "@/actions/holded";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExternalLink, Phone, Mail, Wrench, Pencil, Save, Truck,
  MapPin, User, Receipt, FileText, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { toast } from "sonner";
import { CompactProgressTracker } from "@/components/repair-progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerRow {
  id: string;
  name: string;
  contactType: string;
  holdedContactId: string | null;
  repairCount: number;
  phone: string | null;
  email: string | null;
  updatedAt: Date;
}

interface Props {
  customers: CustomerRow[];
}

export function CustomersTableClient({ customers }: Props) {
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  return (
    <>
      <TableBody>
        {customers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-16 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Wrench className="h-8 w-8 opacity-20" />
                <p className="font-medium text-sm">No contacts found</p>
                <p className="text-xs">Try adjusting your search or filters</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          customers.map((c, idx) => (
            <TableRow
              key={c.id}
              className="group interactive-row table-row-animate"
              style={{ animationDelay: `${idx * 20}ms` }}
              onClick={() => setSelected(c)}
            >
              <TableCell>
                <span className="font-medium text-[13px] group-hover:text-primary transition-colors">
                  {c.name}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                  {c.contactType === "business" ? "Business" : "Person"}
                </Badge>
                {c.holdedContactId && (
                  <span className="inline-flex items-center text-[10px] text-emerald-600 ml-1" title="Linked to Holded">
                    <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {c.repairCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                    {c.repairCount}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">{c.phone ?? "—"}</TableCell>
              <TableCell className="text-[13px] text-muted-foreground hidden md:table-cell">{c.email ?? "—"}</TableCell>
              <TableCell>
                <SmartDate date={c.updatedAt} className="text-[11px] text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>

      {selected && (
        <CustomerQuickView
          customer={selected}
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
    </>
  );
}

function CustomerQuickView({
  customer,
  open,
  onOpenChange,
}: {
  customer: CustomerRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Full detail data loaded on open
  const [fullData, setFullData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdedTab, setHoldedTab] = useState<"invoices" | "quotes">("invoices");

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Load full data when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFullData(null);
    setInvoices([]);
    setQuotes([]);
    setHoldedTab("invoices");

    Promise.all([
      getCustomerById(customer.id),
      getCustomerHoldedInvoices(customer.id),
      getCustomerHoldedQuotes(customer.id),
    ]).then(([data, inv, q]) => {
      setFullData(data);
      setInvoices(inv);
      setQuotes(q);
      if (data) {
        setName(data.name);
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        setMobile(data.mobile ?? "");
        setAddress(data.address ?? "");
        setCity(data.city ?? "");
        setPostalCode(data.postalCode ?? "");
      }
    }).finally(() => setLoading(false));
  }, [open, customer.id]);

  const handleClose = useCallback((v: boolean) => {
    if (!v) {
      setEditing(false);
      setError("");
    }
    onOpenChange(v);
  }, [onOpenChange]);

  function handleSave() {
    setError("");
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, {
          name,
          phone: phone || undefined,
          email: email || undefined,
          mobile: mobile || undefined,
          address: address || undefined,
          city: city || undefined,
          postalCode: postalCode || undefined,
        });
        toast.success("Saved — synced to Holded");
        setEditing(false);
        router.refresh();
        // Refresh full data
        const data = await getCustomerById(customer.id);
        if (data) setFullData(data);
      } catch (err: any) {
        setError(err?.message ?? "Failed to save");
      }
    });
  }

  const c = fullData ?? customer;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="text-lg font-extrabold">{c.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {!editing && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                  setName(c.name);
                  setPhone(c.phone ?? "");
                  setEmail(c.email ?? "");
                  setMobile(fullData?.mobile ?? "");
                  setAddress(fullData?.address ?? "");
                  setCity(fullData?.city ?? "");
                  setPostalCode(fullData?.postalCode ?? "");
                  setEditing(true);
                }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                <Link href={`/customers/${customer.id}`}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Full page
                </Link>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="space-y-4 px-6 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>
            )}

            {/* Badges */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                {c.contactType === "business" ? "Business" : "Person"}
              </Badge>
              {c.holdedContactId && (
                <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400">
                  <RefreshCw className="h-2.5 w-2.5 mr-1" />
                  Syncs to Holded
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-5 w-5" />
              </div>
            ) : editing ? (
              /* ─── Edit mode ─── */
              <div className="space-y-4">
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Mobile</Label>
                    <Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 h-8 text-sm rounded-lg" />
                </div>

                <div className="border-t pt-3">
                  <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-muted-foreground" /> Address
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Street</Label>
                      <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">City</Label>
                        <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Postal Code</Label>
                        <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>

                {c.holdedContactId && (
                  <p className="text-[10px] text-emerald-600">Changes will sync to Holded automatically.</p>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="rounded-lg" disabled={isPending} onClick={handleSave}>
                    {isPending ? <Spinner className="mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              /* ─── Full details view ─── */
              <>
                {/* Contact + Address row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact info */}
                  <div className="rounded-xl border p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-semibold">Contact Info</p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{c.contactType === "business" ? "Business" : "Person"}</span>
                      </div>
                      {c.phone && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> Phone</span>
                          <a href={`tel:${c.phone}`} className="font-medium hover:text-primary">{c.phone}</a>
                        </div>
                      )}
                      {fullData?.mobile && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> Mobile</span>
                          <a href={`tel:${fullData.mobile}`} className="font-medium hover:text-primary">{fullData.mobile}</a>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> Email</span>
                          <a href={`mailto:${c.email}`} className="font-medium hover:text-primary truncate max-w-[140px]">{c.email}</a>
                        </div>
                      )}
                      {c.holdedContactId && (
                        <div className="pt-1.5 border-t">
                          <a
                            href={`https://app.holded.com/contacts/${c.holdedContactId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            View in Holded
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="rounded-xl border p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-semibold">Address</p>
                    </div>
                    {fullData?.address || fullData?.city ? (
                      <div className="text-xs space-y-0.5">
                        {fullData.address && <p className="font-medium">{fullData.address}</p>}
                        <p className="text-muted-foreground">
                          {[fullData.postalCode, fullData.city].filter(Boolean).join(" ")}
                        </p>
                        {(fullData.province || fullData.country) && (
                          <p className="text-muted-foreground">
                            {[fullData.province, fullData.country].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No address on file</p>
                    )}
                  </div>
                </div>

                {/* Units + Repairs row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Units */}
                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-semibold">Units ({fullData?.units?.length ?? 0})</p>
                    </div>
                    {(!fullData?.units || fullData.units.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic">No units linked</p>
                    ) : (
                      <div className="space-y-1">
                        {fullData.units.map((unit: any) => (
                          <Link
                            key={unit.id}
                            href={`/units/${unit.id}`}
                            className="flex items-center gap-2 rounded-lg border p-2 text-xs hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                {[unit.brand, unit.model].filter(Boolean).join(" ") || "No details"}
                              </p>
                              {unit.registration && (
                                <p className="font-mono text-[10px] text-muted-foreground">{unit.registration}</p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Repairs */}
                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-semibold">Repairs ({fullData?.repairJobs?.length ?? 0})</p>
                    </div>
                    {(!fullData?.repairJobs || fullData.repairJobs.length === 0) ? (
                      <p className="text-xs text-muted-foreground italic">No repair jobs linked</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {fullData.repairJobs.map((job: any) => (
                          <Link
                            key={job.id}
                            href={`/repairs/${job.id}`}
                            className="flex items-center justify-between rounded-lg border p-2 text-xs hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 mr-2 flex-1">
                              <p className="font-medium truncate">{job.title || "Unnamed"}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{job.publicCode}</p>
                            </div>
                            <CompactProgressTracker
                              data={{
                                status: job.status,
                                invoiceStatus: job.invoiceStatus ?? "not_invoiced",
                                holdedQuoteId: job.holdedQuoteId,
                                holdedQuoteNum: job.holdedQuoteNum,
                                holdedInvoiceId: job.holdedInvoiceId,
                                holdedInvoiceNum: job.holdedInvoiceNum,
                              }}
                            />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Holded Documents */}
                {(invoices.length > 0 || quotes.length > 0) && (
                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-semibold">Holded Documents</p>
                      <div className="ml-auto flex gap-1">
                        <button
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${holdedTab === "invoices" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => setHoldedTab("invoices")}
                        >
                          Invoices ({invoices.length})
                        </button>
                        <button
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${holdedTab === "quotes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => setHoldedTab("quotes")}
                        >
                          Quotes ({quotes.length})
                        </button>
                      </div>
                    </div>

                    {holdedTab === "invoices" && (
                      <div className="space-y-1">
                        {invoices.map((inv: any) => {
                          const isDraft = inv.status === 0 && inv.draft === 1;
                          const Wrapper = isDraft ? "div" as const : "a" as const;
                          return (
                            <Wrapper
                              key={inv.id}
                              {...(!isDraft ? { href: `/api/holded/pdf?type=invoice&id=${inv.id}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                              className={`flex items-center justify-between rounded-lg border p-2 text-xs transition-colors ${isDraft ? "opacity-60" : "hover:bg-muted/50 cursor-pointer"}`}
                            >
                              <div className="min-w-0 mr-2">
                                <p className="font-medium">{inv.docNumber || "Draft"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {inv.desc || "No description"}
                                  {inv.date && ` · ${new Date(inv.date * 1000).toLocaleDateString("nl-NL")}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-medium tabular-nums">€{inv.total?.toFixed(2) ?? "0.00"}</span>
                                <Badge
                                  variant="secondary"
                                  className={`rounded-full text-[9px] px-1.5 py-0 ${
                                    inv.status === 1
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : inv.status === 2
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-red-50 text-red-700 border-red-200"
                                  }`}
                                >
                                  {inv.status === 1 ? "Paid" : inv.status === 2 ? "Partial" : isDraft ? "Draft" : "Unpaid"}
                                </Badge>
                                {!isDraft && <FileText className="h-2.5 w-2.5 text-muted-foreground" />}
                              </div>
                            </Wrapper>
                          );
                        })}
                      </div>
                    )}

                    {holdedTab === "quotes" && (
                      <div className="space-y-1">
                        {quotes.map((q: any) => {
                          const isDraft = q.draft === 1;
                          const Wrapper = isDraft ? "div" as const : "a" as const;
                          return (
                            <Wrapper
                              key={q.id}
                              {...(!isDraft ? { href: `/api/holded/pdf?type=estimate&id=${q.id}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                              className={`flex items-center justify-between rounded-lg border p-2 text-xs transition-colors ${isDraft ? "opacity-60" : "hover:bg-muted/50 cursor-pointer"}`}
                            >
                              <div className="min-w-0 mr-2">
                                <p className="font-medium">{q.docNumber || "Draft"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {q.desc || "No description"}
                                  {q.date && ` · ${new Date(q.date * 1000).toLocaleDateString("nl-NL")}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-medium tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</span>
                                <Badge
                                  variant="secondary"
                                  className={`rounded-full text-[9px] px-1.5 py-0 ${
                                    q.status === 1
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : isDraft
                                      ? "bg-slate-50 text-slate-700 border-slate-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}
                                >
                                  {q.status === 1 ? "Accepted" : isDraft ? "Draft" : "Sent"}
                                </Badge>
                                {!isDraft && <FileText className="h-2.5 w-2.5 text-muted-foreground" />}
                              </div>
                            </Wrapper>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground pt-1">
                  Updated <SmartDate date={c.updatedAt} className="text-[10px]" />
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
