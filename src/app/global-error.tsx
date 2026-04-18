"use client";

/**
 * Last-resort fallback. Fires when the root layout itself throws
 * (e.g. theme provider crash). Has to render its own <html> + <body>
 * because the normal layout never loaded.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          color: "#1c1917",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#a8a29e",
              margin: 0,
            }}
          >
            Critical error
          </p>
          <h1
            style={{
              marginTop: 6,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            App failed to start
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              lineHeight: 1.55,
              color: "#57534e",
            }}
          >
            Try reloading the page. If that doesn't work, contact support.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#1c1917",
              color: "#fafaf9",
              border: 0,
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.10)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
