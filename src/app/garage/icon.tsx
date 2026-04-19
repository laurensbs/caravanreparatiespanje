import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Tab icon for /garage routes. Amber to differentiate from admin. */
export default function GarageIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f59e0b",
          color: "#1c1917",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          borderRadius: 6,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
        }}
      >
        G
      </div>
    ),
    { ...size },
  );
}
