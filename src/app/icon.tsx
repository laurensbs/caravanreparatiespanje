import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Browser favicon. Generated at build time so we don't need a binary
 * checked into the repo. The "R" matches the app name (Reparatie).
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          color: "#fafaf9",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          borderRadius: 6,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
