import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles";

interface CodeBlockProps {
  lines: Array<{ text: string; color?: string; indent?: number }>;
  title?: string;
  delay?: number;
  typingSpeed?: number;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  lines,
  title = "terminal",
  delay = 0,
  typingSpeed = 2,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const containerOpacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const containerY = interpolate(adjustedFrame, [0, 12], [30, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
        background: "#1a1b26",
        borderRadius: 16,
        border: `1px solid ${colors.bgGlow}`,
        overflow: "hidden",
        boxShadow: `0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px ${colors.primary}11`,
        width: "100%",
        maxWidth: 900,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 20px",
          background: "#15161e",
          borderBottom: `1px solid ${colors.bgGlow}`,
          gap: 8,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#28c840" }} />
        <span
          style={{
            marginLeft: 12,
            fontSize: 14,
            fontFamily: fonts.mono,
            color: colors.textMuted,
          }}
        >
          {title}
        </span>
      </div>

      {/* Code content */}
      <div style={{ padding: "20px 24px" }}>
        {lines.map((line, i) => {
          const lineDelay = i * typingSpeed;
          const lineFrame = Math.max(0, adjustedFrame - 10 - lineDelay);
          const lineOpacity = interpolate(lineFrame, [0, 4], [0, 1], {
            extrapolateRight: "clamp",
          });

          const charsVisible = Math.floor(
            interpolate(lineFrame, [0, Math.max(line.text.length * 0.6, 5)], [0, line.text.length], {
              extrapolateRight: "clamp",
            })
          );

          const visibleText = line.text.substring(0, charsVisible);
          const showCursor = lineFrame > 0 && charsVisible < line.text.length;

          return (
            <div
              key={i}
              style={{
                fontFamily: fonts.mono,
                fontSize: 18,
                lineHeight: "32px",
                color: line.color || "#a9b1d6",
                opacity: lineOpacity,
                paddingLeft: (line.indent || 0) * 24,
                whiteSpace: "pre",
              }}
            >
              {visibleText}
              {showCursor && (
                <span
                  style={{
                    background: colors.primary,
                    width: 10,
                    display: "inline-block",
                    height: 20,
                    marginLeft: 1,
                    opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                  }}
                >
                  &nbsp;
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
