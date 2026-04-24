"use client";

const COLORS = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#a78bfa", "#f43f5e"];

export function launchConfettiBurst() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9999";
  root.setAttribute("aria-hidden", "true");

  const pieces = 90;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("span");
    const size = 5 + Math.random() * 7;
    const drift = (Math.random() - 0.5) * 520;
    const fall = 220 + Math.random() * 300;
    const rotate = (Math.random() - 0.5) * 620;

    piece.style.position = "absolute";
    piece.style.left = "50%";
    piece.style.top = "42%";
    piece.style.width = `${size}px`;
    piece.style.height = `${Math.max(3, size * 0.55)}px`;
    piece.style.borderRadius = "2px";
    piece.style.background = COLORS[i % COLORS.length];
    piece.style.opacity = "0.98";

    piece.animate(
      [
        { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate3d(${drift}px, ${fall}px, 0) rotate(${rotate}deg)`, opacity: 0 },
      ],
      {
        duration: 850 + Math.random() * 450,
        easing: "cubic-bezier(0.22,0.61,0.36,1)",
        fill: "forwards",
      },
    );

    root.appendChild(piece);
  }

  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), 1500);
}
