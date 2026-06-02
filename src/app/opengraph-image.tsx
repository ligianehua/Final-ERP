import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Quill · 翎 — AI Permit Advisor for Philippine SMEs"
export const contentType = "image/png"
export const size = { width: 1200, height: 630 }

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          background: "#fafaf9",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          fontFamily: "system-ui, sans-serif",
          color: "#0c0a09",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <div style={{ fontSize: 88, fontWeight: 600, letterSpacing: "-0.04em" }}>
            Quill
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#78716c",
              border: "1px solid #d6d3d1",
              borderRadius: 8,
              padding: "4px 12px",
            }}
          >
            翎
          </div>
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            lineHeight: 1.15,
            maxWidth: "880px",
            color: "#0c0a09",
          }}
        >
          Snap a photo of a government form. Get a filled PDF in 60 seconds.
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#57534e",
            marginTop: "32px",
          }}
        >
          The AI permit advisor for Philippine SMEs.
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 60,
            right: 72,
            fontSize: 20,
            color: "#a8a29e",
          }}
        >
          BIR · SEC · Mayor&apos;s Permit · SSS · automated
        </div>
      </div>
    ),
    { ...size },
  )
}
