/**
 * Minimal DeepL client — één translate-call, geen dependencies. We
 * leunen op fetch en verpakken alleen de auth + de NL/ES/EN mapping
 * zodat de caller niet hoeft te weten of de free-tier (api-free.deepl.com)
 * of pro-tier (api.deepl.com) draait.
 *
 * Env:
 *   DEEPL_API_KEY — de key uit deepl.com/account/summary. Eindigt op
 *   ":fx" voor free tier; zonder suffix = pro. We routen automatisch.
 */

export type TranslateLang = "en" | "es" | "nl";

// DeepL gebruikt afwijkende codes voor EN (EN-GB / EN-US). Garage
// draait verder in EN-GB-stijl Engels (datums etc.) dus we matchen dat.
const DEEPL_CODE: Record<TranslateLang, string> = {
  en: "EN-GB",
  es: "ES",
  nl: "NL",
};

function apiBase(key: string): string {
  return key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2"
    : "https://api.deepl.com/v2";
}

export function isDeeplConfigured(): boolean {
  return Boolean(process.env.DEEPL_API_KEY);
}

/**
 * Vertaal een tekst naar `to`. Als `from` is opgegeven hint DeepL
 * expliciet welke brontaal (scheelt verkeerde detectie op korte
 * strings). Lege input retourneert lege string zonder API-call.
 * Gooit bij fouten — caller is verantwoordelijk voor try/catch zodat
 * een vertaal-fout nooit de persist-flow breekt.
 */
export async function translateText(
  text: string,
  to: TranslateLang,
  from?: TranslateLang,
): Promise<string> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return "";
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY not configured");
  if (from && from === to) return trimmed;

  const body = new URLSearchParams();
  body.append("text", trimmed);
  body.append("target_lang", DEEPL_CODE[to]);
  if (from) body.append("source_lang", from.toUpperCase());

  const res = await fetch(`${apiBase(key)}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepL ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as {
    translations: Array<{ text: string; detected_source_language: string }>;
  };
  return data.translations?.[0]?.text ?? trimmed;
}

/**
 * Detecteer de brontaal van een stukje tekst — DeepL doet dit impliciet
 * als we een dummy-vertaling vragen en de detected_source_language
 * terugkrijgen. Goedkoop genoeg (1 call) voor de auto-translate flow.
 */
export async function detectLanguage(text: string): Promise<TranslateLang | null> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;

  const body = new URLSearchParams();
  body.append("text", trimmed);
  body.append("target_lang", "EN-GB");

  const res = await fetch(`${apiBase(key)}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    translations: Array<{ text: string; detected_source_language: string }>;
  };
  const code = data.translations?.[0]?.detected_source_language?.toLowerCase();
  if (code === "en" || code === "es" || code === "nl") return code;
  return null;
}

/**
 * High-level helper: gegeven tekst in één brontaal, retourneer alle
 * 3 varianten (en/es/nl) plus de gedetecteerde brontaal.
 * Bij errors returnen we partial: de originele tekst staat altijd in
 * de detected-lang slot, andere talen zijn null als de API faalt.
 */
export async function translateToAll(
  text: string,
  hint?: TranslateLang,
): Promise<{
  en: string | null;
  es: string | null;
  nl: string | null;
  sourceLang: TranslateLang | null;
}> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return { en: null, es: null, nl: null, sourceLang: null };

  const sourceLang = hint ?? (await detectLanguage(trimmed));
  const result: { en: string | null; es: string | null; nl: string | null } = {
    en: sourceLang === "en" ? trimmed : null,
    es: sourceLang === "es" ? trimmed : null,
    nl: sourceLang === "nl" ? trimmed : null,
  };
  const targets: TranslateLang[] = (["en", "es", "nl"] as TranslateLang[]).filter(
    (l) => l !== sourceLang,
  );
  // Serieel ipv parallel — DeepL Free rate-limit is strikt en
  // gelijktijdige requests leveren 429s. 150ms tussen calls houdt
  // ons royaal onder de limiet (max ~6 req/s in de praktijk).
  for (const target of targets) {
    try {
      result[target] = await translateText(trimmed, target, sourceLang ?? undefined);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`DeepL translate to ${target} failed`, err);
      result[target] = null;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { ...result, sourceLang };
}
