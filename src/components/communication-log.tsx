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
  phone: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  whatsapp: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  email: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_person: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  sms: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
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
}

export function CommunicationLogPanel({ repairJobId, logs }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [method, setMethod] = useState("phone");
  const [direction, setDirection] = useState("outbound");
  const [contactPerson, setContactPerson] = useState("");
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
      });
      setDialogOpen(false);
      setSummary("");
      setOutcome("");
      setContactPerson("");
    });
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
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
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <MessageSquare className="mx-auto mb-2 h-6 w-6 opacity-30" />
          <p>No communication logged yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 rounded-lg border p-3 text-sm"
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
