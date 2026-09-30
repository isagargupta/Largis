import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0a1628" }}>
        <div style={{ position: "absolute", left: 28, top: 28, width: 34, height: 124, background: "#ffffff" }} />
        <div style={{ position: "absolute", left: 28, top: 118, width: 124, height: 34, background: "#ffffff" }} />
        <div style={{ position: "absolute", left: 96, top: 28, width: 56, height: 56, background: "#7b8ef0" }} />
      </div>
    ),
    size,
  );
}
