import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon. iOS automatically adds the rounded-rect mask,
 * so we paint a full-bleed background and a centred glyph.
 *
 * Kept neutral (stone-900 + stone-50 letter) so it matches the app
 * chrome whether the user is in light or dark mode.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1c1917 0%, #292524 100%)",
          color: "#fafaf9",
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.06em",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
