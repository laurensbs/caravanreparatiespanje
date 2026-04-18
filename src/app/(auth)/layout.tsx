export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Subtle dot grid for paper texture, fades to transparent at the
          edges so it never competes with the form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,_oklch(0.7_0.005_75/0.15)_1px,_transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,_black_30%,_transparent_75%)]"
      />
      {/* Soft top vignette to lift the logo off the canvas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-foreground/[0.02] to-transparent"
      />
      {children}
    </div>
  );
}
