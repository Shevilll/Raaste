import { ImageResponse } from "next/og";

export const alt = "Raaste — Parking-Congestion Intelligence for Bengaluru Traffic Police";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background:
            "radial-gradient(1100px 700px at 18% 8%, #101a30 0%, #070b14 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#94a3b8",
            fontSize: "26px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "14px",
              height: "14px",
              borderRadius: "9999px",
              background: "#f59e0b",
            }}
          />
          Bengaluru Traffic Police
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "28px",
            fontSize: "172px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#ffffff" }}>Raa</span>
          <span style={{ color: "#f59e0b" }}>ste</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "36px",
            maxWidth: "880px",
            color: "#cbd5e1",
            fontSize: "40px",
            lineHeight: 1.3,
          }}
        >
          Parking-Congestion Intelligence for Bengaluru Traffic Police
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginTop: "52px",
            color: "#64748b",
            fontSize: "28px",
          }}
        >
          <span style={{ color: "#f59e0b" }}>298,450</span>
          <span>BTP parking violations · live demo</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
