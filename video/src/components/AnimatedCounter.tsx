import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles";

interface AnimatedCounterProps {
  value: number;
  label: string;
  suffix?: string;
  delay?: number;
  color?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  label,
  suffix = "",
  delay = 0,
  color = colors.primary,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const progress = interpolate(adjustedFrame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  const currentValue = Math.round(value * progress);
  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(adjustedFrame, [0, 8, 15], [0.8, 1.05, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          fontFamily: fonts.heading,
          color,
          textShadow: `0 0 30px ${color}66`,
          letterSpacing: "-2px",
        }}
      >
        {currentValue}
        {suffix}
      </div>
      <div
        style={{
          fontSize: 20,
          fontFamily: fonts.body,
          color: colors.textMuted,
          marginTop: 8,
          textTransform: "uppercase",
          letterSpacing: "3px",
        }}
      >
        {label}
      </div>
    </div>
  );
};
