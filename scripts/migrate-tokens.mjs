#!/usr/bin/env node
/**
 * One-shot migration from hard-coded gray/white classes to design tokens.
 * Safe to re-run (idempotent). Skips garage-specific files because the
 * garage iPad UI intentionally lives in its own dark colour space.
 *
 * Usage: node scripts/migrate-tokens.mjs [--dry]
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DRY = process.argv.includes("--dry");

const TARGETS = [
  "src/app/(dashboard)",
  "src/components/repairs",
  "src/components/customers",
  "src/components/units",
  "src/components/parts",
  "src/components/planning",
  "src/components/settings",
  "src/components/dashboard",
  "src/components/layout",
  "src/components/communication-log.tsx",
  "src/components/holded-hint.tsx",
  "src/components/smart-assistant.tsx",
  "src/components/smart-suggestions.tsx",
  "src/components/repair-progress.tsx",
  "src/components/garage-sync-ui.tsx",
];

const SKIP = [
  "src/components/garage",
  "src/app/garage",
];

// Pure mapping. Order matters: longer keys first so sub-strings don't match.
const MAP = [
  // Brand legacy hex
  ["#0CC0DF", "currentColor"],

  // Border tokens
  ["border-gray-100", "border-border/60"],
  ["border-gray-200", "border-border"],
  ["border-gray-800", "border-border"],
  ["border-gray-700", "border-border"],
  ["divide-gray-100", "divide-border/60"],
  ["divide-gray-200", "divide-border"],
  ["divide-gray-800", "divide-border/60"],

  // Background surfaces
  ["bg-white/80", "bg-card/80"],
  ["bg-white/70", "bg-card/70"],
  ["bg-white/60", "bg-card/60"],
  ["bg-white/40", "bg-card/40"],
  ["bg-white", "bg-card"],
  ["bg-gray-50", "bg-muted/40"],
  ["bg-gray-100", "bg-muted"],
  ["bg-gray-900", "bg-foreground"],
  ["bg-gray-950", "bg-background"],

  // Foreground tones
  ["text-gray-900", "text-foreground"],
  ["text-gray-800", "text-foreground"],
  ["text-gray-700", "text-foreground/90"],
  ["text-gray-600", "text-muted-foreground"],
  ["text-gray-500", "text-muted-foreground"],
  ["text-gray-400", "text-muted-foreground/70"],
  ["text-gray-300", "text-muted-foreground/50"],

  // Hover variants
  ["hover:bg-gray-50", "hover:bg-muted/60"],
  ["hover:bg-gray-100", "hover:bg-muted"],
  ["hover:text-gray-900", "hover:text-foreground"],
  ["hover:text-gray-700", "hover:text-foreground/90"],
  ["hover:border-gray-200", "hover:border-border"],
  ["hover:border-gray-300", "hover:border-foreground/20"],

  // Dark mode duplicates we just neutralise (the tokens already swap)
  ["dark:bg-gray-900", "dark:bg-card"],
  ["dark:bg-gray-950", "dark:bg-background"],
  ["dark:bg-white/[0.03]", "dark:bg-white/[0.03]"], // keep as-is, looks ok
  ["dark:border-gray-800", "dark:border-border"],
  ["dark:border-gray-700", "dark:border-border"],
  ["dark:text-gray-100", "dark:text-foreground"],
  ["dark:text-gray-200", "dark:text-foreground/90"],
  ["dark:text-gray-300", "dark:text-foreground/80"],
  ["dark:text-gray-400", "dark:text-muted-foreground"],
  ["dark:text-gray-500", "dark:text-muted-foreground/70"],
];

function shouldSkip(path) {
  return SKIP.some((s) => path.includes(s));
}

function isTarget(path) {
  if (shouldSkip(path)) return false;
  const ext = extname(path);
  if (![".tsx", ".ts"].includes(ext)) return false;
  return true;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

const files = [];
for (const target of TARGETS) {
  const full = join(ROOT, target);
  try {
    const st = statSync(full);
    if (st.isDirectory()) {
      for (const f of walk(full)) {
        if (isTarget(f)) files.push(f);
      }
    } else if (isTarget(full)) {
      files.push(full);
    }
  } catch {}
}

let changed = 0;
let totalReplacements = 0;
for (const file of files) {
  const orig = readFileSync(file, "utf8");
  let next = orig;
  let hits = 0;
  for (const [from, to] of MAP) {
    const before = next;
    next = next.split(from).join(to);
    hits += (before.length - next.length === 0 && before === next) ? 0 : 1;
  }
  if (next !== orig) {
    changed++;
    const diffCount = orig.length - next.length;
    totalReplacements += hits;
    if (!DRY) writeFileSync(file, next);
    console.log(`${DRY ? "DRY  " : "WROTE"} ${relative(ROOT, file)} (Δ ${diffCount} chars, ${hits} pattern hits)`);
  }
}

console.log(`\n${DRY ? "Would touch" : "Touched"} ${changed} files (${totalReplacements} pattern hits)`);
