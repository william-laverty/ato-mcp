import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ato-mcp — The Australian tax knowledge base for AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHIPS = ["ITAA 1997 · s 8-1", "PCG 2023/1", "TR 93/30"];

export default async function OgImage() {
  const [regular, medium] = await Promise.all([
    fetch(new URL("./fonts/Switzer-Regular.otf", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL("./fonts/Switzer-Medium.otf", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
  ]);

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
          backgroundColor: "#ffffff",
          color: "#18181b",
          fontFamily: "Switzer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: "#fa520f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 9999,
                backgroundColor: "#ffffff",
              }}
            />
            <div
              style={{
                width: 13,
                height: 7,
                borderRadius: 9999,
                backgroundColor: "#ffffff",
              }}
            />
          </div>
          <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: -0.5 }}>
            ato-mcp
          </div>
          <div
            style={{
              marginLeft: 8,
              fontSize: 17,
              color: "#71717a",
              border: "1px solid #e4e4e7",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            v1.0 · open source
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 500,
              letterSpacing: -1.6,
              lineHeight: 1.06,
              maxWidth: 950,
              color: "#18181b",
            }}
          >
            Your AI agent, fluent in Australian tax
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 400,
              color: "#71717a",
              maxWidth: 880,
              lineHeight: 1.4,
            }}
          >
            Cited retrieval over 29,000+ ATO documents, the ITAA 1997 and 2,127
            public rulings — plus tax workflow tools that know your situation.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {CHIPS.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontSize: 18,
                color: "#c2410c",
                backgroundColor: "#fff3ec",
                borderRadius: 8,
                padding: "9px 18px",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  backgroundColor: "#fa520f",
                }}
              />
              {c}
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 18, color: "#a1a1aa" }}>
            ato-mcp.com.au
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Switzer", data: regular, weight: 400, style: "normal" },
        { name: "Switzer", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
