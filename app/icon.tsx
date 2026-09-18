import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
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
          background: "#0a120e",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 300,
            fontWeight: 700,
            color: "#00c46a",
            fontFamily: "sans-serif",
          }}
        >
          26
        </div>
      </div>
    ),
    { ...size }
  );
}
