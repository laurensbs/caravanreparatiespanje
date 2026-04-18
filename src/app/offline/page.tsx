import Image from "next/image";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/favicon.png"
          alt=""
          width={120}
          height={84}
          className="mx-auto mb-5 object-contain opacity-80 dark:invert"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Offline
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
          Geen verbinding
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Je werk wordt lokaal bewaard en gesynchroniseerd zodra je weer online
          bent. Probeer de pagina te verversen of check je netwerk.
        </p>
      </div>
    </div>
  );
}
