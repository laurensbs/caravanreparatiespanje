"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLanguage } from "@/components/garage/language-toggle";

/**
 * Discrete offline-indicator voor de garage-iPad.
 *
 * Verschijnt alleen als `navigator.onLine === false`. Visueel een smalle
 * rode pill onder de statusbalk — niet blokkerend, niet modal, werkers
 * kunnen gewoon doorklikken (fetches naar timer/foto etc. zullen wel
 * falen maar ze weten nu dat het aan het netwerk ligt, niet aan de
 * app).
 *
 * Gebruikt in `garage/layout.tsx`.
 */
export function GarageOfflineIndicator() {
  const { t } = useLanguage();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Initialiseren in een effect i.p.v. tijdens SSR: `navigator` bestaat
    // daar niet en `useState(true)` is dus de veilige default die tijdens
    // hydrate niet mismatcht.
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[80] flex justify-center px-3 motion-safe:animate-fade-in"
    >
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg ring-1 ring-rose-400/50 backdrop-blur-sm">
        <WifiOff className="h-3.5 w-3.5" />
        <span>
          {t(
            "No internet — changes will sync when you reconnect",
            "Sin internet — los cambios se sincronizarán al reconectar",
            "Geen internet — wijzigingen worden gesynchroniseerd zodra je weer online bent",
          )}
        </span>
      </div>
    </div>
  );
}
