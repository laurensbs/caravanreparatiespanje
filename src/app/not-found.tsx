import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-foreground/[0.05] blur-3xl"
      />
      <div className="w-full max-w-sm text-center">
        <Image
          src="/favicon.png"
          alt=""
          width={120}
          height={84}
          className="mx-auto mb-6 object-contain opacity-90 dark:invert"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          De link bestaat niet meer, of je hebt geen toegang. Geen zorgen — niets
          is kapot.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="h-3.5 w-3.5" />
              Back to dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/repairs">
              <ArrowLeft className="btn-arrow-left h-3.5 w-3.5" />
              View work orders
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
