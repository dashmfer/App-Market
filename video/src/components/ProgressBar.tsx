import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles";

interface ProgressBarProps {
  label: string;
  value: number;
  maxValue: number;
  delay?: number;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  value,
  maxValue,
  delay = 0,
  color = colors.accent,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const width = interpolate(adjustedFrame, [5, 35], [0, (value / maxValue) * 100], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity, width: "100%", marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontFamily: fonts.body,
            color: colors.text,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 18,
            fontFamily: fonts.mono,
            color,
          }}
        >
          {value}/{maxValue}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: colors.bgGlow,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: 4,
            boxShadow: `0 0 20px ${color}44`,
          }}
        />
      </div>
    </div>
  );
};
