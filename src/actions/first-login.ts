"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";

/**
 * Pre-login check: gebruikt door het loginscherm om te bepalen of het
 * geselecteerde account bij eerste keer inloggen meteen een nieuw wachtwoord
 * moet kiezen (in plaats van het bestaande wachtwoord in te voeren).
 *
 * Geeft alleen een boolean terug — nooit gevoelige info — zodat dit veilig
 * vanuit een unauthenticated context aangeroepen kan worden.
 */
export async function checkMustChangePassword(email: string): Promise<boolean> {
  if (!email) return false;
  const [user] = await db
    .select({
      mustChangePassword: users.mustChangePassword,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  if (!user || !user.active) return false;
  return user.mustChangePassword;
}

/**
 * Zet een nieuw wachtwoord voor een account dat nog `mustChangePassword=true`
 * heeft staan. Vereist géén huidig wachtwoord (de gebruiker logt voor het
 * eerst in). Faalt expliciet als de vlag al uit staat, zodat dit endpoint
 * niet als algemene reset-route gebruikt kan worden.
 */
export async function setInitialPassword(data: {
  email: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = (data.email ?? "").toLowerCase().trim();
  const newPassword = data.newPassword ?? "";

  if (!email) {
    return { ok: false, error: "Account ontbreekt" };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "Wachtwoord moet minimaal 6 tekens zijn" };
  }

  const [user] = await db
    .select({
      id: users.id,
      mustChangePassword: users.mustChangePassword,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.active) {
    return { ok: false, error: "Account niet gevonden" };
  }
  if (!user.mustChangePassword) {
    return { ok: false, error: "Wachtwoord is al ingesteld" };
  }

  const hashedPassword = await hash(newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: hashedPassword, mustChangePassword: false })
    .where(eq(users.id, user.id));

  return { ok: true };
}
