/**
 * NL-vertalingen backfill voor alle rijen die al ES hebben. Rolf en
 * Mark zijn de enigen die NL zien, maar we vullen 'm voor alles
 * zodat hun view consistent is. DeepL-call: bron = EN (origineel),
 * target = NL. Één call per tekst-veld.
 *
 * Run: npx tsx scripts/backfill-dutch-only.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { repairJobs, repairTasks, repairFindings } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { translateText, isDeeplConfigured } from "@/lib/deepl";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translateOne(text: string): Promise<string | null> {
  try {
    const out = await translateText(text, "nl");
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
        isNull(repairJobs.titleNl),
        isNull(repairJobs.deletedAt),
      ),
    );
  console.log(`Job titles to translate (NL): ${rows.length}`);
  let done = 0;
  for (const r of rows) {
    if (!r.title?.trim()) continue;
    const nl = await translateOne(r.title);
    if (nl) {
      await db
        .update(repairJobs)
        .set({ titleNl: nl, updatedAt: new Date() })
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
        isNull(repairJobs.descriptionNl),
        isNull(repairJobs.deletedAt),
      ),
    );
  console.log(`Job descriptions to translate (NL): ${rows.length}`);
  let done = 0;
  for (const r of rows) {
    if (!r.descriptionRaw?.trim()) continue;
    const nl = await translateOne(r.descriptionRaw);
    if (nl) {
      await db
        .update(repairJobs)
        .set({ descriptionNl: nl, updatedAt: new Date() })
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
    .where(and(isNotNull(repairTasks.title), isNull(repairTasks.titleNl)));
  console.log(`Task titles to translate (NL): ${rows.length}`);
  for (const r of rows) {
    if (!r.title?.trim()) continue;
    const nl = await translateOne(r.title);
    if (nl) {
      await db
        .update(repairTasks)
        .set({ titleNl: nl, updatedAt: new Date() })
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
    .where(isNull(repairFindings.descriptionNl));
  console.log(`Findings to translate (NL): ${rows.length}`);
  for (const r of rows) {
    if (!r.description?.trim()) continue;
    const nl = await translateOne(r.description);
    if (nl) {
      await db
        .update(repairFindings)
        .set({ descriptionNl: nl })
        .where(eq(repairFindings.id, r.id));
    }
  }
}

async function main() {
  if (!isDeeplConfigured()) {
    console.error("DEEPL_API_KEY missing in .env");
    process.exit(1);
  }
  console.log("Dutch-only backfill via DeepL…");
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
