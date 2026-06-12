import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ato-mcp — The Australian tax knowledge base for AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#05030f",
          backgroundImage:
            "radial-gradient(60% 50% at 12% 24%, rgba(255,138,60,0.22) 0%, transparent 64%)," +
            "radial-gradient(70% 55% at 55% 0%, rgba(122,92,255,0.3) 0%, transparent 70%)," +
            "radial-gradient(46% 38% at 85% 90%, rgba(80,57,189,0.28) 0%, transparent 66%)",
          color: "#f4f2f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: "#5039bd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              color: "#f4f2f7",
            }}
          >
            ◈
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>ato-mcp</div>
          <div
            style={{
              marginLeft: 8,
              fontSize: 18,
              color: "rgba(244,242,247,0.65)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            v1.0 · open source
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05, maxWidth: 980 }}>
            Your AI agent just became fluent in Australian tax.
          </div>
          <div style={{ fontSize: 26, color: "rgba(244,242,247,0.7)", maxWidth: 900 }}>
            Cited retrieval over 29,000+ ATO documents, ITAA 1997 & rulings — plus tax
            workflow tools that know your situation. Local or hosted.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["ITAA 1997 · s 8-1", "TR 97/12", "PCG 2023/1", "Div 40", "GSTR 2000/27"].map((c) => (
            <div
              key={c}
              style={{
                fontSize: 18,
                color: "#d8cdf7",
                backgroundColor: "rgba(122,92,255,0.14)",
                border: "1px solid rgba(199,148,255,0.35)",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
