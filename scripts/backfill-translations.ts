/**
 * Bulk-backfill: vertaal alle repair_jobs, repair_tasks en
 * repair_findings die nog geen Es/Nl hebben via DeepL. Handig na
 * de 0033-migratie en voor elke partij werkorders die vóór de
 * auto-translate-feature zijn aangemaakt.
 *
 * Run: tsx scripts/backfill-translations.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { repairJobs, repairTasks, repairFindings } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull, or } from "drizzle-orm";
import { translateToAll, isDeeplConfigured } from "@/lib/deepl";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backfillJobs() {
  const jobs = await db
    .select({
      id: repairJobs.id,
      title: repairJobs.title,
      descriptionRaw: repairJobs.descriptionRaw,
      titleEs: repairJobs.titleEs,
      descriptionEs: repairJobs.descriptionEs,
    })
    .from(repairJobs)
    .where(
      and(
        isNull(repairJobs.deletedAt),
        or(
          and(isNotNull(repairJobs.title), isNull(repairJobs.titleEs)),
          and(isNotNull(repairJobs.descriptionRaw), isNull(repairJobs.descriptionEs)),
        ),
      ),
    );
  console.log(`Jobs to backfill: ${jobs.length}`);
  for (const j of jobs) {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (j.title && !j.titleEs) {
      const { en, es, nl, sourceLang } = await translateToAll(j.title);
      patch.title = en ?? j.title;
      patch.titleEs = es;
      patch.titleNl = nl;
      patch.titleLang = sourceLang;
    }
    if (j.descriptionRaw && !j.descriptionEs) {
      const { en, es, nl, sourceLang } = await translateToAll(j.descriptionRaw);
      patch.descriptionRaw = en ?? j.descriptionRaw;
      patch.descriptionEs = es;
      patch.descriptionNl = nl;
      patch.descriptionLang = sourceLang;
    }
    await db.update(repairJobs).set(patch).where(eq(repairJobs.id, j.id));
    console.log(`  job ${j.id} — ${j.title ?? "(no title)"}`);
    await sleep(600);
  }
}

async function backfillTasks() {
  const tasks = await db
    .select({
      id: repairTasks.id,
      title: repairTasks.title,
      titleEs: repairTasks.titleEs,
    })
    .from(repairTasks)
    .where(isNull(repairTasks.titleEs));
  console.log(`Tasks to backfill: ${tasks.length}`);
  for (const t of tasks) {
    if (!t.title?.trim()) continue;
    const { en, es, nl } = await translateToAll(t.title);
    await db
      .update(repairTasks)
      .set({
        title: en ?? t.title,
        titleEs: es,
        titleNl: nl,
        updatedAt: new Date(),
      })
      .where(eq(repairTasks.id, t.id));
    console.log(`  task ${t.id} — ${t.title}`);
    await sleep(600);
  }
}

async function backfillFindings() {
  const findings = await db
    .select({
      id: repairFindings.id,
      description: repairFindings.description,
      descriptionEs: repairFindings.descriptionEs,
    })
    .from(repairFindings)
    .where(isNull(repairFindings.descriptionEs));
  console.log(`Findings to backfill: ${findings.length}`);
  for (const f of findings) {
    if (!f.description?.trim()) continue;
    const { en, es, nl, sourceLang } = await translateToAll(f.description);
    await db
      .update(repairFindings)
      .set({
        description: en ?? f.description,
        descriptionEs: es,
        descriptionNl: nl,
        descriptionLang: sourceLang,
      })
      .where(eq(repairFindings.id, f.id));
    console.log(`  finding ${f.id} — ${f.description.slice(0, 60)}`);
    await sleep(600);
  }
}

async function main() {
  if (!isDeeplConfigured()) {
    console.error("DEEPL_API_KEY missing — set it in .env first.");
    process.exit(1);
  }
  console.log("Starting backfill via DeepL…");
  await backfillJobs();
  await backfillTasks();
  await backfillFindings();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
