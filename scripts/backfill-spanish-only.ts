/**
 * Eénmalige Spaans-only backfill voor bestaande rows. Roept per rij
 * DeepL één keer aan (target ES) en laat title_nl / description_nl
 * leeg — die vullen we niet in voor oude data.
 *
 * Run: npx tsx scripts/backfill-spanish-only.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { repairJobs, repairTasks, repairFindings } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { translateText, isDeeplConfigured } from "@/lib/deepl";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translateOne(text: string): Promise<string | null> {
  try {
    const out = await translateText(text, "es");
    await sleep(150);
    return out || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("  skip:", (err as Error).message);
    return null;
  }
}

async function backfillJobTitles() {
  const rows = await db
    .select({ id: repairJobs.id, title: repairJobs.title })
    .from(repairJobs)
    .where(
      and(
        isNotNull(repairJobs.title),
        isNull(repairJobs.titleEs),
        isNull(repairJobs.deletedAt),
      ),
    );
  console.log(`Job titles to translate: ${rows.length}`);
  let done = 0;
  for (const r of rows) {
    if (!r.title?.trim()) continue;
    const es = await translateOne(r.title);
    if (es) {
      await db
        .update(repairJobs)
        .set({ titleEs: es, updatedAt: new Date() })
        .where(eq(repairJobs.id, r.id));
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${rows.length} titles…`);
  }
}

async function backfillJobDescriptions() {
  const rows = await db
    .select({
      id: repairJobs.id,
      descriptionRaw: repairJobs.descriptionRaw,
    })
    .from(repairJobs)
    .where(
      and(
        isNotNull(repairJobs.descriptionRaw),
        isNull(repairJobs.descriptionEs),
        isNull(repairJobs.deletedAt),
      ),
    );
  console.log(`Job descriptions to translate: ${rows.length}`);
  let done = 0;
  for (const r of rows) {
    if (!r.descriptionRaw?.trim()) continue;
    const es = await translateOne(r.descriptionRaw);
    if (es) {
      await db
        .update(repairJobs)
        .set({ descriptionEs: es, updatedAt: new Date() })
        .where(eq(repairJobs.id, r.id));
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${rows.length} descriptions…`);
  }
}

async function backfillTaskTitles() {
  const rows = await db
    .select({ id: repairTasks.id, title: repairTasks.title })
    .from(repairTasks)
    .where(and(isNotNull(repairTasks.title), isNull(repairTasks.titleEs)));
  console.log(`Task titles to translate: ${rows.length}`);
  for (const r of rows) {
    if (!r.title?.trim()) continue;
    const es = await translateOne(r.title);
    if (es) {
      await db
        .update(repairTasks)
        .set({ titleEs: es, updatedAt: new Date() })
        .where(eq(repairTasks.id, r.id));
    }
  }
}

async function backfillFindings() {
  const rows = await db
    .select({
      id: repairFindings.id,
      description: repairFindings.description,
    })
    .from(repairFindings)
    .where(isNull(repairFindings.descriptionEs));
  console.log(`Findings to translate: ${rows.length}`);
  for (const r of rows) {
    if (!r.description?.trim()) continue;
    const es = await translateOne(r.description);
    if (es) {
      await db
        .update(repairFindings)
        .set({ descriptionEs: es })
        .where(eq(repairFindings.id, r.id));
    }
  }
}

async function main() {
  if (!isDeeplConfigured()) {
    console.error("DEEPL_API_KEY missing in .env");
    process.exit(1);
  }
  console.log("Spanish-only backfill via DeepL…");
  await backfillJobTitles();
  await backfillJobDescriptions();
  await backfillTaskTitles();
  await backfillFindings();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
