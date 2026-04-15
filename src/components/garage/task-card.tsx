"use client";

import { useTransition, useState, useRef } from "react";
import { useLanguage } from "@/components/garage/language-toggle";
import { updateTaskStatus } from "@/actions/garage";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { toast } from "sonner";
import { Camera } from "lucide-react";

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
  const status = task.status as RepairTaskStatus;
  const isDone = status === "done";

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
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm transition-all duration-150 ${isPending ? "opacity-60" : ""} ${isDone ? "opacity-60" : ""}`}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <span className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm leading-none shrink-0 mt-0.5 ${
            status === "done" ? "bg-emerald-50 text-emerald-600" :
            status === "in_progress" ? "bg-sky-50 text-sky-600" :
            status === "problem" ? "bg-red-50 text-red-600" :
            status === "review" ? "bg-amber-50 text-amber-600" :
            "bg-gray-50 text-gray-400"
          }`}>
            {STATUS_ICONS[status]}
          </span>

          <div className="flex-1 min-w-0">
            {/* Title + approval badge */}
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium leading-snug ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
                {title}
              </span>
              {task.source === "garage" && !task.approvedAt && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 shrink-0">
                  {t("Pending", "Pendiente", "Wachtend")}
                </span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{task.description}</p>
            )}

            {/* Problem info */}
            {status === "problem" && task.problemCategory && (
              <div className="mt-1.5 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-xs text-red-700">
                <strong>{task.problemCategory.replace("_", " ")}</strong>
                {task.problemNote && <span>: {task.problemNote}</span>}
              </div>
            )}
          </div>

          {/* Camera button — always accessible */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-all shrink-0 mt-0.5"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        {/* Uploaded photos */}
        {photos.length > 0 && (
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.url}
                alt={photo.caption || "Task photo"}
                className="h-14 w-14 rounded-lg object-cover shrink-0 border border-gray-100"
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {actions.map((action) => (
              <button
                key={action.status}
                onClick={() => handleStatusChange(action.status)}
                disabled={isPending}
                className={`flex-1 rounded-xl h-11 text-sm font-semibold transition-all active:scale-[0.97] ${action.className}`}
              >
                {t(action.labelEn, action.labelEs, action.labelNl)}
              </button>
            ))}
          </div>
        )}
      </div>

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
          className: "bg-gray-900 text-white",
        },
      ];
    case "in_progress":
      return [
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ Done",
          labelEs: "✓ Listo",
          labelNl: "✓ Klaar",
          className: "bg-emerald-500 text-white",
        },
        {
          status: "problem" as RepairTaskStatus,
          labelEn: "⚠ Problem",
          labelEs: "⚠ Problema",
          labelNl: "⚠ Probleem",
          className: "bg-white text-red-600 border border-red-200",
        },
      ];
    case "problem":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "↻ Retry",
          labelEs: "↻ Reintentar",
          labelNl: "↻ Opnieuw",
          className: "bg-gray-900 text-white",
        },
      ];
    case "review":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "▶ Rework",
          labelEs: "▶ Rehacer",
          labelNl: "▶ Herwerk",
          className: "bg-gray-900 text-white",
        },
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ OK",
          labelEs: "✓ OK",
          labelNl: "✓ OK",
          className: "bg-emerald-500 text-white",
        },
      ];
    case "done":
      return [];
    default:
      return [];
  }
}
