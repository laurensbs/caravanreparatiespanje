"use client";

import { useTransition, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/garage/language-toggle";
import { updateTaskStatus } from "@/actions/garage";
import type { RepairTask, RepairTaskStatus, ProblemCategory } from "@/types";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/types";
import { toast } from "sonner";

const STATUS_ICONS: Record<RepairTaskStatus, string> = {
  pending: "○",
  in_progress: "◐",
  done: "✓",
  problem: "⚠",
  review: "↻",
};

interface TaskCardProps {
  task: RepairTask;
  repairJobId: string;
  onUpdate: () => void;
  onProblem: (taskId: string) => void;
  photos?: { id: string; url: string; caption: string | null }[];
}

export function TaskCard({ task, repairJobId, onUpdate, onProblem, photos = [] }: TaskCardProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const title = t(task.title, task.titleEs, task.titleNl);

  function handleStatusChange(newStatus: RepairTaskStatus) {
    if (newStatus === "problem") {
      onProblem(task.id);
      return;
    }
    startTransition(async () => {
      await updateTaskStatus(task.id, newStatus);
      onUpdate();
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("repairJobId", repairJobId);
        formData.append("repairTaskId", task.id);
        formData.append("photoType", "task");
        const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }
      }
      toast.success(t("Photo uploaded", "Foto subida", "Foto geüpload"));
      onUpdate();
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Determine which action buttons to show
  const actions = getActions(task.status);

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${isPending ? "opacity-60" : ""} ${
      task.status === "problem" ? "border-red-200 bg-red-50" : ""
    } ${task.status === "done" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <span className="mt-0.5 text-2xl leading-none">
          {STATUS_ICONS[task.status as RepairTaskStatus]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-base ${task.status === "done" ? "line-through" : ""}`}>
              {title}
            </span>
            <Badge className={`text-xs ${TASK_STATUS_COLORS[task.status as RepairTaskStatus]}`}>
              {TASK_STATUS_LABELS[task.status as RepairTaskStatus]}
            </Badge>
            {task.source === "garage" && !task.approvedAt && (
              <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                {t("Pending approval", "Pendiente", "Wacht op goedkeuring")}
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-500 mt-1">{task.description}</p>
          )}

          {/* Problem info */}
          {task.status === "problem" && task.problemCategory && (
            <div className="mt-2 rounded-lg bg-red-100 p-2 text-sm text-red-800">
              <strong>{task.problemCategory.replace("_", " ")}</strong>
              {task.problemNote && <span>: {task.problemNote}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Uploaded photos */}
      {photos.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.caption || "Task photo"}
              className="h-16 w-16 rounded-xl object-cover shrink-0 border border-gray-100"
            />
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Action buttons + photo upload */}
      <div className="flex gap-2 mt-3">
        {actions.map((action) => (
          <button
            key={action.status}
            onClick={() => handleStatusChange(action.status)}
            disabled={isPending}
            className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold transition-colors active:scale-[0.98] ${action.className}`}
          >
            {t(action.labelEn, action.labelEs, action.labelNl)}
          </button>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={`rounded-xl px-3 py-3 text-sm font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-[0.98] transition-colors ${actions.length === 0 ? "flex-1" : ""}`}
        >
          {uploading
            ? t("Uploading...", "Subiendo...", "Uploaden...")
            : `📷${actions.length === 0 ? ` ${t("Add photo", "Añadir foto", "Foto toevoegen")}` : ""}`}
        </button>
      </div>
    </div>
  );
}

function getActions(status: string) {
  switch (status) {
    case "pending":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "▶ Start",
          labelEs: "▶ Iniciar",
          labelNl: "▶ Start",
          className: "bg-blue-500 text-white",
        },
      ];
    case "in_progress":
      return [
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ Done",
          labelEs: "✓ Listo",
          labelNl: "✓ Klaar",
          className: "bg-green-500 text-white",
        },
        {
          status: "problem" as RepairTaskStatus,
          labelEn: "⚠ Problem",
          labelEs: "⚠ Problema",
          labelNl: "⚠ Probleem",
          className: "bg-red-50 text-red-600 border border-red-200",
        },
      ];
    case "problem":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "↻ Retry",
          labelEs: "↻ Reintentar",
          labelNl: "↻ Opnieuw",
          className: "bg-blue-500 text-white",
        },
      ];
    case "review":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "▶ Rework",
          labelEs: "▶ Rehacer",
          labelNl: "▶ Herwerk",
          className: "bg-blue-500 text-white",
        },
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ OK",
          labelEs: "✓ OK",
          labelNl: "✓ OK",
          className: "bg-green-500 text-white",
        },
      ];
    case "done":
      return [];
    default:
      return [];
  }
}
