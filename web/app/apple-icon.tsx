import { ImageResponse } from "next/og";

/* Home-screen icon: the Pair mark, white on brand purple (iOS rounds the corners). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#8a1fc7" }}>
        <svg viewBox="0 0 64 64" width="136" height="136">
          <circle cx="24" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="7.5" />
          <circle cx="40" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="7.5" strokeOpacity="0.6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
