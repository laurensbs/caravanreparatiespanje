/**
 * Client-side foto compressie vóór upload.
 *
 * iPad-camera spuugt 3-5 MB JPEGs uit bij elke tap op de sluiter. Op de
 * werkvloer-WiFi (vaak karig) geeft dat 5-15 seconden wachten per foto,
 * terwijl een werker 4-8 foto's per klus maakt. Dat kost minuten.
 *
 * Deze helper schaalt elke geselecteerde foto naar maximaal `MAX_DIM`
 * pixels aan de lange zijde en re-encodeert als JPEG met `QUALITY`. In
 * de praktijk betekent dat een 4032×3024 iPad-foto (~4.5 MB) wordt
 * ~450 KB — factor 10 kleiner zonder zichtbaar verlies op een
 * controle-foto van een waterlek of een krasje in de wand.
 *
 * We laten foto's al kleiner dan `SKIP_UNDER_BYTES` met rust (al klein
 * genoeg, re-encode zou onnodig degradatie introduceren). Als de
 * browser het bestand niet als afbeelding kan decoderen (bv. HEIC op
 * oudere browsers), valt de helper terug op het origineel.
 */

/** Max lange zijde in pixels na resize. */
const MAX_DIM = 1920;

/** JPEG kwaliteit bij re-encoden (0..1). 0.82 is de sweet-spot waar
 *  artefacten voor het blote oog onzichtbaar blijven maar file size
 *  flink daalt. */
const QUALITY = 0.82;

/** Onder deze grootte niet compressen — kost meer dan het oplevert. */
const SKIP_UNDER_BYTES = 400 * 1024;

/** Bestanden waarvan we de compressie overslaan (al gecomprimeerd of
 *  niet-raster: bijv. pdf, video, audio). */
const SKIP_TYPES = [
  "image/gif", // animatie, frames zouden verloren gaan
  "image/svg+xml",
  "image/webp", // meestal al klein
];

export interface CompressOptions {
  maxDim?: number;
  quality?: number;
  skipUnderBytes?: number;
}

/**
 * Probeert een `File` te comprimeren. Retourneert de originele `File`
 * als compressie mislukt of niet nodig is. Werkt volledig client-side,
 * geen netwerk calls.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? MAX_DIM;
  const quality = opts.quality ?? QUALITY;
  const skipUnder = opts.skipUnderBytes ?? SKIP_UNDER_BYTES;

  // Non-image of skip-list — geef origineel terug.
  if (!file.type.startsWith("image/")) return file;
  if (SKIP_TYPES.includes(file.type)) return file;
  if (file.size < skipUnder) return file;

  try {
    // `createImageBitmap` is efficiënter dan `new Image()` + FileReader
    // en werkt met een `File`/`Blob` direct; op Safari 17+ werkt hij
    // ook voor HEIC (iOS 17 convert intern naar JPEG bij decoding).
    const bitmap = await createImageBitmap(file);
    const { width: srcW, height: srcH } = bitmap;

    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const targetW = Math.round(srcW * scale);
    const targetH = Math.round(srcH * scale);

    // Als de foto al binnen de max-dim past EN van type JPEG is met
    // relatief lage quality inschatting, alsnog comprimeren: de file
    // is > SKIP_UNDER_BYTES dus er valt wat te winnen.
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    // Als de "gecomprimeerde" versie groter is (kan bij al sterk
    // gecomprimeerde PNGs met weinig pixels), val terug op origineel.
    if (blob.size >= file.size) return file;

    // Hernoem netjes naar .jpg zodat de server-side content-type
    // detectie niet verward raakt.
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const newName = `${baseName}.jpg`;
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch (err) {
    // Decode mislukt (bv. corrupte foto) — geef origineel terug,
    // server moet uiteindelijk ook zelf met de inhoud kunnen omgaan.
    if (process.env.NODE_ENV === "development") {
      console.warn("[compressImage] decoding failed, using original", err);
    }
    return file;
  }
}

/** Comprimeert een lijst bestanden. Serieel om iPad RAM niet
 *  te overvragen bij het decoden van 10 foto's tegelijk. */
export async function compressImages(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await compressImage(f));
  }
  return out;
}
