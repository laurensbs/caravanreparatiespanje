"use client";

import { useState, useRef } from "react";
import { Camera, Plus, X, Loader2, Image as ImageIcon, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface GaragePhotoUploadProps {
  repairJobId: string;
  repairTaskId?: string;
  photos: { id: string; url: string; caption: string | null }[];
  onUpdate: () => void;
  t: (en: string, es: string, nl: string) => string;
  compact?: boolean;
}

/**
 * Photo upload that gives the worker an explicit choice between camera capture
 * and the device gallery. Some phones (especially Android) ignore `accept`
 * when `capture` is set, which used to lock workers into the camera. Two
 * dedicated inputs solve that and add no friction on iOS either.
 */
export function GaragePhotoUpload({
  repairJobId,
  repairTaskId,
  photos,
  onUpdate,
  t,
  compact = false,
}: GaragePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

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
          const text = await res.text();
          let msg = "Upload failed";
          try {
            msg = JSON.parse(text).error || msg;
          } catch {}
          throw new Error(msg);
        }
        successCount++;
        setUploadCount(successCount);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(`${file.name}: ${msg}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        t(
          `${successCount} photo${successCount > 1 ? "s" : ""} uploaded`,
          `${successCount} foto${successCount > 1 ? "s" : ""} subida${successCount > 1 ? "s" : ""}`,
          `${successCount} foto${successCount > 1 ? "'s" : ""} geüpload`,
        ),
      );
      onUpdate();
    }

    setUploading(false);
    setUploadCount(0);
    setTotalCount(0);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function openPicker() {
    setShowSheet(true);
  }

  function pickCamera() {
    setShowSheet(false);
    cameraRef.current?.click();
  }

  function pickGallery() {
    setShowSheet(false);
    galleryRef.current?.click();
  }

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/20 hover:text-white/40 hover:bg-white/[0.06] active:bg-white/[0.1] transition-all shrink-0"
            aria-label={t("Add photo", "Añadir foto", "Foto toevoegen")}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          {photos.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setViewPhoto(photo.url)}
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || ""}
                    className="h-10 w-10 rounded-lg object-cover border border-white/[0.08]"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        <PhotoSourceSheet
          open={showSheet}
          onClose={() => setShowSheet(false)}
          onCamera={pickCamera}
          onGallery={pickGallery}
          t={t}
        />

        {viewPhoto && (
          <PhotoLightbox photo={viewPhoto} onClose={() => setViewPhoto(null)} />
        )}
      </>
    );
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white/90">
            <span className="flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-white/30" />
              {t("Photos", "Fotos", "Foto's")}
              {photos.length > 0 && (
                <span className="text-[10px] bg-white/[0.06] text-white/40 rounded-full px-1.5 py-0.5 font-bold">
                  {photos.length}
                </span>
              )}
            </span>
          </h2>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setViewPhoto(photo.url)}
                  className="aspect-square overflow-hidden bg-white/[0.04] relative group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                      <p className="text-[10px] text-white truncate">{photo.caption}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-0.5 border-t border-white/[0.04]">
              <button
                type="button"
                onClick={pickCamera}
                disabled={uploading}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white/50 transition-all hover:bg-white/[0.04] active:bg-white/[0.06] active:scale-[0.98]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t(`Uploading ${uploadCount}/${totalCount}…`, `Subiendo ${uploadCount}/${totalCount}…`, `Uploaden ${uploadCount}/${totalCount}…`)}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    {t("Camera", "Cámara", "Camera")}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={pickGallery}
                disabled={uploading}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white/50 transition-all border-l border-white/[0.04] hover:bg-white/[0.04] active:bg-white/[0.06] active:scale-[0.98]"
              >
                <ImagePlus className="h-4 w-4" />
                {t("Gallery", "Galería", "Galerij")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPicker}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-8 text-sm font-medium text-white/30 transition-all active:scale-[0.98] hover:text-white/50 hover:bg-white/[0.04]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t(`Uploading ${uploadCount}/${totalCount}…`, `Subiendo ${uploadCount}/${totalCount}…`, `Uploaden ${uploadCount}/${totalCount}…`)}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-white/20" />
                  </div>
                  <span>{t("Tap to add photos", "Toca para añadir fotos", "Tik om foto's toe te voegen")}</span>
                  <span className="text-xs text-white/15">
                    {t("Camera or gallery", "Cámara o galería", "Camera of galerij")}
                  </span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      <PhotoSourceSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        onCamera={pickCamera}
        onGallery={pickGallery}
        t={t}
      />

      {viewPhoto && (
        <PhotoLightbox photo={viewPhoto} onClose={() => setViewPhoto(null)} />
      )}
    </>
  );
}

/**
 * Bottom-sheet style action sheet that asks the worker to pick camera vs gallery.
 * Animated, large tap targets, safe-area aware.
 */
function PhotoSourceSheet({
  open,
  onClose,
  onCamera,
  onGallery,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  t: (en: string, es: string, nl: string) => string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-background ring-1 ring-white/10 shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl motion-safe:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-white/10 sm:hidden" />
        <div className="px-4 pt-3 pb-2">
          <p className="text-center text-[12px] font-medium text-white/40">
            {t("Add photos", "Añadir fotos", "Foto's toevoegen")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <button
            type="button"
            onClick={onCamera}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-5 text-white transition-all active:scale-[0.97] hover:bg-white/[0.07]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300">
              <Camera className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-semibold">{t("Camera", "Cámara", "Camera")}</span>
            <span className="text-[10.5px] text-white/40">{t("Take photo", "Tomar foto", "Foto maken")}</span>
          </button>
          <button
            type="button"
            onClick={onGallery}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-5 text-white transition-all active:scale-[0.97] hover:bg-white/[0.07]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300">
              <ImagePlus className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-semibold">{t("Gallery", "Galería", "Galerij")}</span>
            <span className="text-[10.5px] text-white/40">{t("Pick from device", "Desde dispositivo", "Vanaf apparaat")}</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mx-2 mb-2 mt-1 block w-[calc(100%-1rem)] rounded-2xl bg-white/[0.04] py-3 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.07]"
        >
          {t("Cancel", "Cancelar", "Annuleren")}
        </button>
      </div>
    </div>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 motion-safe:animate-fade-in"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Re-export Plus to avoid breaking any consumers that imported it transitively.
export { Plus };
