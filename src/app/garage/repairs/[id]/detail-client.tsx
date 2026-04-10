"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { TaskCard } from "@/components/garage/task-card";
import { ProblemDialog } from "@/components/garage/problem-dialog";
import { FinalCheckDialog } from "@/components/garage/final-check";
import { addGarageComment, suggestExtraTask } from "@/actions/garage";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/types";
import type { RepairTask, RepairPhoto, RepairStatus, Priority } from "@/types";
import { toast } from "sonner";

type RepairDetail = {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  descriptionRaw: string | null;
  notesRaw: string | null;
  internalComments: string | null;
  customerName: string | null;
  customerId: string | null;
  unitRegistration: string | null;
  unitBrand: string | null;
  unitModel: string | null;
  unitId: string | null;
  assignedUserName: string | null;
  assignedUserId: string | null;
  finalCheckStatus: string | null;
  finalCheckNotes: string | null;
  tasks: RepairTask[];
  photos: RepairPhoto[];
};

interface Props {
  repair: RepairDetail;
}

export function GarageRepairDetailClient({ repair }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [problemTaskId, setProblemTaskId] = useState<string | null>(null);
  const [showFinalCheck, setShowFinalCheck] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [isPending, startTransition] = useTransition();

  const allDone = repair.tasks.length > 0 && repair.tasks.every((t) => t.status === "done");
  const hasTasks = repair.tasks.length > 0;
  const doneCount = repair.tasks.filter((t) => t.status === "done").length;

  function handleRefresh() {
    router.refresh();
  }

  function handleAddComment() {
    if (!commentText.trim()) return;
    startTransition(async () => {
      await addGarageComment(repair.id, commentText);
      setCommentText("");
      setShowComment(false);
      toast.success(t("Comment added", "Comentario añadido", "Opmerking toegevoegd"));
      router.refresh();
    });
  }

  function handleSuggest() {
    if (!suggestTitle.trim()) return;
    startTransition(async () => {
      await suggestExtraTask(repair.id, suggestTitle, suggestDesc || undefined);
      setSuggestTitle("");
      setSuggestDesc("");
      setShowSuggest(false);
      toast.success(t("Task suggested", "Tarea sugerida", "Taak voorgesteld"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/garage")}
            className="flex items-center gap-1 text-sm text-muted-foreground active:opacity-70"
          >
            ← {t("Back", "Atrás", "Terug")}
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              onClick={handleRefresh}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-lg active:bg-muted"
            >
              ↻
            </button>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg">{repair.publicCode}</span>
            <Badge className={STATUS_COLORS[repair.status as RepairStatus]}>
              {STATUS_LABELS[repair.status as RepairStatus]}
            </Badge>
            <Badge className={PRIORITY_COLORS[repair.priority as Priority]}>
              {PRIORITY_LABELS[repair.priority as Priority]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {repair.unitRegistration && <span className="font-medium mr-2">{repair.unitRegistration}</span>}
            {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ")}
            {repair.customerName && <span> — {repair.customerName}</span>}
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4">

        {/* Office notes (read-only) */}
        {(repair.descriptionRaw || repair.notesRaw || repair.internalComments) && (
          <div className="rounded-xl border bg-amber-50/50 p-4">
            <h3 className="text-sm font-bold text-amber-700 mb-1">
              📋 {t("Office Notes", "Notas de Oficina", "Kantoor Notities")}
            </h3>
            {repair.descriptionRaw && (
              <p className="text-sm whitespace-pre-wrap">{repair.descriptionRaw}</p>
            )}
            {repair.notesRaw && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-muted-foreground">{repair.notesRaw}</p>
            )}
            {repair.internalComments && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-muted-foreground italic">{repair.internalComments}</p>
            )}
          </div>
        )}

        {/* Final check banner */}
        {repair.finalCheckStatus === "failed" && repair.finalCheckNotes && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4">
            <h3 className="text-sm font-bold text-red-700 mb-1">
              ✗ {t("Final Check Failed", "Control Final Fallido", "Natest Afgekeurd")}
            </h3>
            <p className="text-sm text-red-800">{repair.finalCheckNotes}</p>
          </div>
        )}

        {/* Task list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {t("Tasks", "Tareas", "Taken")}
              {hasTasks && (
                <span className="ml-2 font-normal">
                  {doneCount}/{repair.tasks.length}
                </span>
              )}
            </h3>
          </div>

          {hasTasks ? (
            <div className="space-y-3">
              {repair.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdate={handleRefresh}
                  onProblem={(id) => setProblemTaskId(id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              <p>{t("No tasks assigned yet", "Sin tareas asignadas", "Nog geen taken toegewezen")}</p>
            </div>
          )}
        </div>

        {/* Photos */}
        {repair.photos.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
              {t("Photos", "Fotos", "Foto's")} ({repair.photos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {repair.photos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                  <img
                    src={photo.thumbnailUrl ?? photo.url}
                    alt={photo.caption ?? ""}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comment form (expandable) */}
        {showComment && (
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-bold">
              💬 {t("Add Comment", "Añadir Comentario", "Opmerking Toevoegen")}
            </h3>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("Type your message...", "Escribe tu mensaje...", "Typ je bericht...")}
              className="w-full rounded-xl border p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowComment(false)} className="flex-1 h-11 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button onClick={handleAddComment} disabled={!commentText.trim() || isPending} className="flex-1 h-11 rounded-xl">
                {t("Send", "Enviar", "Verstuur")}
              </Button>
            </div>
          </div>
        )}

        {/* Suggest task form (expandable) */}
        {showSuggest && (
          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-bold">
              ➕ {t("Suggest Extra Task", "Sugerir Tarea Extra", "Extra Taak Voorstellen")}
            </h3>
            <input
              value={suggestTitle}
              onChange={(e) => setSuggestTitle(e.target.value)}
              placeholder={t("Task name...", "Nombre de tarea...", "Naam van taak...")}
              className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <textarea
              value={suggestDesc}
              onChange={(e) => setSuggestDesc(e.target.value)}
              placeholder={t("Description (optional)...", "Descripción (opcional)...", "Beschrijving (optioneel)...")}
              className="w-full rounded-xl border p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSuggest(false)} className="flex-1 h-11 rounded-xl">
                {t("Cancel", "Cancelar", "Annuleren")}
              </Button>
              <Button onClick={handleSuggest} disabled={!suggestTitle.trim() || isPending} className="flex-1 h-11 rounded-xl">
                {t("Suggest", "Sugerir", "Voorstellen")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-xl px-4 py-3 flex gap-2 safe-area-pb">
        {!showComment && !showSuggest && (
          <>
            <button
              onClick={() => setShowComment(true)}
              className="flex-1 rounded-xl border p-3 text-sm font-medium active:bg-muted transition-colors"
            >
              💬 {t("Comment", "Comentario", "Opmerking")}
            </button>
            <button
              onClick={() => setShowSuggest(true)}
              className="flex-1 rounded-xl border p-3 text-sm font-medium active:bg-muted transition-colors"
            >
              ➕ {t("Extra Task", "Tarea Extra", "Extra Taak")}
            </button>
            {allDone && repair.finalCheckStatus !== "passed" && (
              <button
                onClick={() => setShowFinalCheck(true)}
                className="flex-1 rounded-xl bg-amber-500 text-white p-3 text-sm font-bold active:bg-amber-600 transition-colors"
              >
                🔍 {t("Final Check", "Control", "Natest")}
              </button>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <ProblemDialog
        open={!!problemTaskId}
        onClose={() => setProblemTaskId(null)}
        taskId={problemTaskId}
        onComplete={handleRefresh}
      />
      <FinalCheckDialog
        repairJobId={repair.id}
        open={showFinalCheck}
        onClose={() => setShowFinalCheck(false)}
        onComplete={handleRefresh}
      />
    </div>
  );
}
