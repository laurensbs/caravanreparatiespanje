/**
 * Categorize all parts and capitalize names.
 * Categories: elektra, chassis, ramen, carrosserie, sanitair, klimaat, stalling, transport, reiniging, diensten, materiaal, interieur
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/lib/db";
import { parts } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

// Category mapping rules — keywords → category
const CATEGORY_RULES: [string[], string][] = [
  // Elektra
  [["kabel", "plug", "stekker", "7-pin", "13 pin", "7 pin", "verlichting", "achterlicht", "positielicht", "contour", "voorlicht", "zijlicht", "led", "lampen", "caraluna", "hella", "hylander", "omvormer", "220v", "batterij", "stopcontact", "light", "binnenverlichting"], "elektra"],
  // Chassis & wielwerk
  [["band", "tyre", "tire", "rem ", "brake", "neuswiel", "poot", "schokbreker", "breekkabel", "oplooprem", "ventiel", "valve", "dissel", "wielhouder", "mover", "reflecterende driehoek"], "chassis"],
  // Ramen & dakluiken
  [["raam", "window", "dakluik", "heki", "remitop", "mpk", "raamuitzetter", "polyfix", "mini heki", "midi heki", "50x50", "28x28", "32x36", "40x40", "50x70", "96x65"], "ramen"],
  // Carrosserie
  [["verf", "plamuur", "spuiten", "uitdeuken", "bumper", "bies", "biezen", "beading", "sticker", "emblemen", "painting", "dak caravan"], "carrosserie"],
  // Sanitair & gas
  [["pompje", "kraan", "toilet", "gas", "schoorsteen", "truma", "keuken", "mengkraan"], "sanitair"],
  // Klimaat
  [["airco", "koelkast", "freshjet", "dometic"], "klimaat"],
  // Stalling
  [["stalling", "storage", "opslag", "wohnwagenlagerung"], "stalling"],
  // Transport
  [["transport", "repatri", "brandstof", "kilo", "voorrijkosten", "campingbezoek"], "transport"],
  // Reiniging
  [["reini", "washing", "wax", "polish", "stoom", "cleaning", "behandeling"], "reiniging"],
  // Interieur
  [["handgreep", "handvat", "deurslot", "deurvanger", "tenstok", "luifel", "voortent", "awning", "fiamma", "intern reinig", "interieur"], "interieur"],
  // Diensten
  [["arbeid", "uur", "controle", "service", "reparatie", "repair", "jaarlijks", "technische hulp", "campingbezoek", "onderdelen"], "diensten"],
  // Materiaal
  [["materiaal", "klein materiaal", "verzendkosten", "gasfles", "brandstof", "borg"], "materiaal"],
];

function categorize(name: string): string {
  const lower = name.toLowerCase();
  for (const [keywords, cat] of CATEGORY_RULES) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }
  return "diensten"; // default
}

function capitalize(name: string): string {
  // Capitalize first letter of each word, keep special chars
  return name
    .split(/(\s+)/)
    .map((word) => {
      if (word.trim() === "") return word;
      // Preserve all-caps abbreviations like LED, MPK, NFC, LMC, TEC
      if (/^[A-Z]{2,}$/.test(word)) return word;
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

async function main() {
  const allParts = await db.select({ id: parts.id, name: parts.name }).from(parts);
  
  let updated = 0;
  for (const p of allParts) {
    const category = categorize(p.name);
    const newName = capitalize(p.name);
    
    await db
      .update(parts)
      .set({ category, name: newName, updatedAt: new Date() })
      .where(eq(parts.id, p.id));
    updated++;
    
    if (newName !== p.name) {
      console.log(`  ✏️  "${p.name}" → "${newName}" [${category}]`);
    }
  }
  
  // Show category counts
  const counts: Record<string, number> = {};
  for (const p of allParts) {
    const cat = categorize(p.name);
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  
  console.log("\n📊 Category breakdown:");
  for (const [cat, cnt] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${cnt}`);
  }
  
  console.log(`\n✅ Updated ${updated} parts with categories and capitalized names`);
  process.exit(0);
}

main();
