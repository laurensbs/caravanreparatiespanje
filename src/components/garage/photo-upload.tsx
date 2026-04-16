"use client";

import { useState, useRef } from "react";
import { Camera, Plus, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface GaragePhotoUploadProps {
  repairJobId: string;
  repairTaskId?: string;
  photos: { id: string; url: string; caption: string | null }[];
  onUpdate: () => void;
  t: (en: string, es: string, nl: string) => string;
  compact?: boolean;
}

export function GaragePhotoUpload({ repairJobId, repairTaskId, photos, onUpdate, t, compact = false }: GaragePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploading(true);
    setTotalCount(fileArray.length);
    setUploadCount(0);

    let successCount = 0;
    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("repairJobId", repairJobId);
        if (repairTaskId) formData.append("repairTaskId", repairTaskId);
        formData.append("photoType", repairTaskId ? "task" : "general");

        const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }
        successCount++;
        setUploadCount(successCount);
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message || "Upload failed"}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        t(
          `${successCount} photo${successCount > 1 ? "s" : ""} uploaded`,
          `${successCount} foto${successCount > 1 ? "s" : ""} subida${successCount > 1 ? "s" : ""}`,
          `${successCount} foto${successCount > 1 ? "'s" : ""} geüpload`
        )
      );
      onUpdate();
    }

    setUploading(false);
    setUploadCount(0);
    setTotalCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (compact) {
    return (
      <>
        {/* Compact: just camera button + inline thumbnails */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-all shrink-0"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          {photos.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {photos.map((photo) => (
                <button key={photo.id} onClick={() => setViewPhoto(photo.url)} className="shrink-0">
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className="h-10 w-10 rounded-lg object-cover border border-gray-100"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleUpload} />

        {/* Lightbox */}
        {viewPhoto && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
            <button className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setViewPhoto(null)}>
              <X className="h-5 w-5" />
            </button>
            <img src={viewPhoto} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">
            <span className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-gray-400" />
              {t("Photos", "Fotos", "Foto's")}
              {photos.length > 0 && (
                <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-bold">
                  {photos.length}
                </span>
              )}
            </span>
          </h2>
        </div>

        {/* Upload area + gallery */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Gallery */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setViewPhoto(photo.url)}
                  className="aspect-square overflow-hidden bg-gray-100 relative group"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className="w-full h-full object-cover"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                      <p className="text-[10px] text-white truncate">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Upload button area */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`w-full flex items-center justify-center gap-2 text-sm font-medium transition-all active:scale-[0.98] ${
              photos.length > 0
                ? "px-4 py-3 text-gray-500 hover:bg-gray-50 active:bg-gray-100 border-t border-gray-50"
                : "px-4 py-8 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t(
                  `Uploading ${uploadCount}/${totalCount}...`,
                  `Subiendo ${uploadCount}/${totalCount}...`,
                  `Uploaden ${uploadCount}/${totalCount}...`
                )}
              </>
            ) : photos.length > 0 ? (
              <>
                <Plus className="h-4 w-4" />
                {t("Add Photos", "Añadir Fotos", "Foto's Toevoegen")}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-gray-400" />
                </div>
                <span>{t("Tap to add photos", "Toca para añadir fotos", "Tik om foto's toe te voegen")}</span>
                <span className="text-xs text-gray-300">{t("Camera or gallery", "Cámara o galería", "Camera of galerij")}</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {/* Lightbox */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <button className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setViewPhoto(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={viewPhoto} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
