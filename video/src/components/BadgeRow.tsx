import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles";

interface Badge {
  label: string;
  icon: string;
  color: string;
}

interface BadgeRowProps {
  badges: Badge[];
  delay?: number;
}

export const BadgeRow: React.FC<BadgeRowProps> = ({ badges, delay = 0 }) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  return (
    <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
      {badges.map((badge, i) => {
        const badgeDelay = i * 6;
        const badgeFrame = Math.max(0, adjustedFrame - badgeDelay);

        const opacity = interpolate(badgeFrame, [0, 10], [0, 1], {
          extrapolateRight: "clamp",
        });
        const scale = interpolate(badgeFrame, [0, 6, 12], [0.6, 1.08, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 24px",
              background: `${badge.color}12`,
              border: `1px solid ${badge.color}44`,
              borderRadius: 12,
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            <span style={{ fontSize: 28 }}>{badge.icon}</span>
            <span
              style={{
                fontFamily: fonts.body,
                fontSize: 18,
                fontWeight: 600,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
