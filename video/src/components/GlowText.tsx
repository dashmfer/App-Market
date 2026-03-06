import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles";

interface GlowTextProps {
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
  glowColor?: string;
}

export const GlowText: React.FC<GlowTextProps> = ({
  text,
  fontSize = 64,
  delay = 0,
  color = colors.text,
  glowColor = colors.primary,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const y = interpolate(adjustedFrame, [0, 15], [40, 0], {
    extrapolateRight: "clamp",
  });

  const glowIntensity = interpolate(
    Math.sin(adjustedFrame * 0.08),
    [-1, 1],
    [20, 40]
  );

  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        fontFamily: fonts.heading,
        color,
        opacity,
        transform: `translateY(${y}px)`,
        textShadow: `0 0 ${glowIntensity}px ${glowColor}66, 0 0 ${glowIntensity * 2}px ${glowColor}22`,
        letterSpacing: "-1px",
        lineHeight: 1.1,
      }}
    >
      {text}
    </div>
  );
};
