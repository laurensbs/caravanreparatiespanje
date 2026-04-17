import { redirect } from "next/navigation";

/** Old /audit URLs → settings (bookmarks & external links). */
export default async function LegacyAuditRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) p.append(k, item);
    } else {
      p.set(k, v);
    }
  }
  const qs = p.toString();
  redirect(qs ? `/settings/audit?${qs}` : "/settings/audit");
}
