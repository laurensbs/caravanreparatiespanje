"use client";

import { useTransition, useState, useRef } from "react";
import { useLanguage } from "@/components/garage/language-toggle";
import { updateTaskStatus } from "@/actions/garage";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { toast } from "sonner";

const STATUS_ICONS: Record<RepairTaskStatus, string> = {
  pending: "○",
  in_progress: "◐",
  done: "✓",
  problem: "⚠",
  review: "↻",
};

const STATUS_BG: Record<RepairTaskStatus, string> = {
  pending: "bg-white border-gray-100",
  in_progress: "bg-sky-50/50 border-sky-100",
  done: "bg-emerald-50/30 border-emerald-100",
  problem: "bg-red-50 border-red-200",
  review: "bg-amber-50/50 border-amber-100",
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
  const status = task.status as RepairTaskStatus;
  const bg = STATUS_BG[status] ?? STATUS_BG.pending;

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

  const actions = getActions(task.status);

  return (
    <div className={`rounded-2xl border ${bg} p-4 shadow-sm transition-all ${isPending ? "opacity-60" : ""} ${
      task.status === "done" ? "opacity-70" : ""
    }`}>
      <div className="flex items-start gap-3">
        {/* Status icon — larger touch area */}
        <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/80 text-xl leading-none shadow-sm border border-gray-100 shrink-0">
          {STATUS_ICONS[status]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <span className={`font-semibold text-[15px] leading-snug ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
            {title}
          </span>

          {/* Pending approval badge */}
          {task.source === "garage" && !task.approvedAt && (
            <span className="inline-flex items-center ml-2 rounded-lg bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              {t("Pending", "Pendiente", "Wachtend")}
            </span>
          )}

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-400 mt-0.5 leading-snug">{task.description}</p>
          )}

          {/* Problem info */}
          {task.status === "problem" && task.problemCategory && (
            <div className="mt-2 rounded-xl bg-red-100/80 p-2.5 text-sm text-red-800">
              <strong>{task.problemCategory.replace("_", " ")}</strong>
              {task.problemNote && <span>: {task.problemNote}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Uploaded photos */}
      {photos.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
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

      {/* Action buttons — min 44px height touch targets */}
      <div className="flex gap-2 mt-3">
        {actions.map((action) => (
          <button
            key={action.status}
            onClick={() => handleStatusChange(action.status)}
            disabled={isPending}
            className={`flex-1 rounded-xl px-3 py-3.5 text-sm font-bold transition-all active:scale-[0.97] ${action.className}`}
          >
            {t(action.labelEn, action.labelEs, action.labelNl)}
          </button>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={`rounded-xl px-3 py-3.5 text-sm font-bold bg-gray-100 text-gray-500 active:bg-gray-200 active:scale-[0.97] transition-all ${actions.length === 0 ? "flex-1" : ""}`}
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
          className: "bg-sky-500 text-white shadow-sm",
        },
      ];
    case "in_progress":
      return [
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ Done",
          labelEs: "✓ Listo",
          labelNl: "✓ Klaar",
          className: "bg-emerald-500 text-white shadow-sm",
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
          className: "bg-sky-500 text-white shadow-sm",
        },
      ];
    case "review":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "▶ Rework",
          labelEs: "▶ Rehacer",
          labelNl: "▶ Herwerk",
          className: "bg-sky-500 text-white shadow-sm",
        },
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ OK",
          labelEs: "✓ OK",
          labelNl: "✓ OK",
          className: "bg-emerald-500 text-white shadow-sm",
        },
      ];
    case "done":
      return [];
    default:
      return [];
  }
}
