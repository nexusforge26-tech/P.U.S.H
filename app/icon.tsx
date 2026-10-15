import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

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
          background: "#2F3D2A",
          color: "#F3EEE1",
          borderRadius: "16px",
          fontSize: 36,
          fontWeight: 900,
          fontFamily: "serif",
        }}
      >
        P
      </div>
    ),
    { ...size }
  );
}
