import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon for the garage tablet PWA. We use a distinct
 * amber background so a worker can tell at a glance whether they
 * tapped the admin app or the garage app on a shared device.
 */
export default function GarageAppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          color: "#1c1917",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: "-0.06em",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
        }}
      >
        G
      </div>
    ),
    { ...size },
  );
}
