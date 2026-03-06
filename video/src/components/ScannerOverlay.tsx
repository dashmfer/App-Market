import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors } from "../styles";

/**
 * Animated scanning line effect that moves across the screen
 */
export const ScannerOverlay: React.FC<{ delay?: number; speed?: number }> = ({
  delay = 0,
  speed = 0.02,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const opacity = interpolate(adjustedFrame, [0, 10], [0, 0.3], {
    extrapolateRight: "clamp",
  });

  const scanY = (adjustedFrame * speed * 1080) % 1080;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity,
      }}
    >
      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          top: scanY,
          left: 0,
          width: "100%",
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${colors.primary} 50%, transparent 100%)`,
          boxShadow: `0 0 30px ${colors.primary}88, 0 0 60px ${colors.primary}44`,
        }}
      />
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `
            linear-gradient(${colors.primary}08 1px, transparent 1px),
            linear-gradient(90deg, ${colors.primary}08 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
};
