import { db } from "@/lib/db";
import { repairJobs, repairTasks, repairFindings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isDeeplConfigured, translateToAll } from "@/lib/deepl";

/**
 * Fire-and-forget auto-translate voor een repair-job. Detecteert de
 * brontaal van title + descriptionRaw en vult descriptionEs/Nl +
 * titleEs/Nl in. Draait in de achtergrond (geen await vereist) zodat
 * een vertaal-fout nooit de save-flow breekt.
 *
 * Triggerpunten:
 * - createRepairJob() wanneer title/description is gezet
 * - updateRepairJob() wanneer een van beide velden is gewijzigd
 */
export function translateRepairJobBg(
  repairJobId: string,
  input: { title?: string | null; description?: string | null },
): void {
  if (!isDeeplConfigured()) return;
  void (async () => {
    try {
      const jobs: Array<Promise<void>> = [];
      if (input.title && input.title.trim()) {
        jobs.push(
          (async () => {
            const { en, es, nl, sourceLang } = await translateToAll(input.title!);
            await db
              .update(repairJobs)
              .set({
                title: en ?? input.title ?? undefined,
                titleEs: es,
                titleNl: nl,
                titleLang: sourceLang,
                updatedAt: new Date(),
              })
              .where(eq(repairJobs.id, repairJobId));
          })(),
        );
      }
      if (input.description && input.description.trim()) {
        jobs.push(
          (async () => {
            const { en, es, nl, sourceLang } = await translateToAll(input.description!);
            await db
              .update(repairJobs)
              .set({
                descriptionRaw: en ?? input.description ?? undefined,
                descriptionEs: es,
                descriptionNl: nl,
                descriptionLang: sourceLang,
                updatedAt: new Date(),
              })
              .where(eq(repairJobs.id, repairJobId));
          })(),
        );
      }
      await Promise.all(jobs);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("translateRepairJobBg failed", repairJobId, err);
    }
  })();
}

/**
 * Auto-translate voor een repair-task title. Task.description blijft nu
 * ongewijzigd (nauwelijks gebruikt in de UI). Background fire-and-forget.
 */
export function translateRepairTaskBg(
  repairTaskId: string,
  input: { title?: string | null },
): void {
  if (!isDeeplConfigured()) return;
  if (!input.title || !input.title.trim()) return;
  void (async () => {
    try {
      const { en, es, nl } = await translateToAll(input.title!);
      await db
        .update(repairTasks)
        .set({
          title: en ?? input.title ?? undefined,
          titleEs: es,
          titleNl: nl,
          updatedAt: new Date(),
        })
        .where(eq(repairTasks.id, repairTaskId));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("translateRepairTaskBg failed", repairTaskId, err);
    }
  })();
}

/**
 * Auto-translate voor een finding-description.
 */
export function translateFindingBg(
  findingId: string,
  input: { description?: string | null },
): void {
  if (!isDeeplConfigured()) return;
  if (!input.description || !input.description.trim()) return;
  void (async () => {
    try {
      const { en, es, nl, sourceLang } = await translateToAll(input.description!);
      await db
        .update(repairFindings)
        .set({
          description: en ?? input.description ?? undefined,
          descriptionEs: es,
          descriptionNl: nl,
          descriptionLang: sourceLang,
        })
        .where(eq(repairFindings.id, findingId));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("translateFindingBg failed", findingId, err);
    }
  })();
}
