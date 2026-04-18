"use client";

import { useState, useTransition } from "react";
import { Phone, MessageSquare, Mail, User2, ArrowUpRight, ArrowDownLeft, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addCommunicationLog } from "@/actions/communications";
import { format } from "date-fns";

const METHOD_ICONS: Record<string, React.ReactNode> = {
  phone: <Phone className="h-3.5 w-3.5" />,
  whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  in_person: <User2 className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  other: <MessageSquare className="h-3.5 w-3.5" />,
};

const METHOD_LABELS: Record<string, string> = {
  phone: "Phone Call",
  whatsapp: "WhatsApp",
  email: "Email",
  in_person: "In Person",
  sms: "SMS",
  other: "Other",
};

const METHOD_COLORS: Record<string, string> = {
  phone: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  whatsapp: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  email: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  in_person: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  sms: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  other: "bg-muted/40 text-muted-foreground dark:bg-foreground/[0.06] dark:text-muted-foreground/70",
};

interface CommunicationLog {
  id: string;
  contactMethod: string;
  direction: string;
  contactPerson: string | null;
  summary: string;
  outcome: string | null;
  contactedAt: Date;
}

interface Props {
  repairJobId: string;
  logs: CommunicationLog[];
  customerName?: string;
}

function toLocalDatetime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CommunicationLogPanel({ repairJobId, logs, customerName }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [method, setMethod] = useState("phone");
  const [direction, setDirection] = useState("outbound");
  const [contactPerson, setContactPerson] = useState(customerName ?? "");
  const [contactedAt, setContactedAt] = useState(toLocalDatetime(new Date()));
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");

  function handleSubmit() {
    if (!summary.trim()) return;

    startTransition(async () => {
      await addCommunicationLog({
        repairJobId,
        contactMethod: method,
        direction,
        contactPerson: contactPerson.trim() || undefined,
        summary: summary.trim(),
        outcome: outcome.trim() || undefined,
        contactedAt: new Date(contactedAt),
      });
      setDialogOpen(false);
      setSummary("");
      setOutcome("");
      setContactPerson(customerName ?? "");
      setContactedAt(toLocalDatetime(new Date()));
    });
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (open) setContactedAt(toLocalDatetime(new Date()));
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-xl text-xs h-8 border-border dark:border-border">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Log Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Communication</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Method
                  </label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            {METHOD_ICONS[k]}
                            {v}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Direction
                  </label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">
                        <span className="flex items-center gap-2">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Outbound
                        </span>
                      </SelectItem>
                      <SelectItem value="inbound">
                        <span className="flex items-center gap-2">
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          Inbound
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Contact Person
                  </label>
                  <Input
                    placeholder="Name of person contacted"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Date & Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={contactedAt}
                    onChange={(e) => setContactedAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Summary *
                </label>
                <Textarea
                  placeholder="What was discussed?"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Outcome
                </label>
                <Input
                  placeholder="e.g., Customer will call back tomorrow"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isPending || !summary.trim()}
              >
                <Send className="mr-2 h-4 w-4" />
                {isPending ? "Saving..." : "Save Log Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border dark:border-border py-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50 dark:text-muted-foreground" />
          <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground">No customer communication logged yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 rounded-xl border border-border/60 dark:border-border bg-muted/40 dark:bg-foreground/30 p-3 text-sm"
            >
              <div className="shrink-0 mt-0.5">
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${METHOD_COLORS[log.contactMethod] ?? ""}`}
                >
                  {METHOD_ICONS[log.contactMethod]}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-xs">
                    {METHOD_LABELS[log.contactMethod] ?? log.contactMethod}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {log.direction === "inbound" ? "← Inbound" : "→ Outbound"}
                  </span>
                  {log.contactPerson && (
                    <span className="text-[10px] text-muted-foreground">
                      · {log.contactPerson}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{log.summary}</p>
                {log.outcome && (
                  <p className="text-xs text-primary mt-1">
                    Outcome: {log.outcome}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(log.contactedAt), "dd MMM yyyy HH:mm")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
