import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles";

interface CommitEntry {
  hash: string;
  message: string;
  type: "fix" | "ci" | "docs" | "chore";
}

const typeColors: Record<string, string> = {
  fix: colors.accent,
  ci: colors.primary,
  docs: colors.secondary,
  chore: colors.warning,
};

const typeLabels: Record<string, string> = {
  fix: "FIX",
  ci: "CI/CD",
  docs: "AUDIT",
  chore: "CHORE",
};

interface CommitTimelineProps {
  commits: CommitEntry[];
  delay?: number;
}

export const CommitTimeline: React.FC<CommitTimelineProps> = ({
  commits,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {commits.map((commit, i) => {
        const entryDelay = i * 4;
        const entryFrame = Math.max(0, adjustedFrame - entryDelay);

        const opacity = interpolate(entryFrame, [0, 6], [0, 1], {
          extrapolateRight: "clamp",
        });
        const x = interpolate(entryFrame, [0, 8], [-40, 0], {
          extrapolateRight: "clamp",
        });

        const badgeColor = typeColors[commit.type] || colors.textMuted;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              opacity,
              transform: `translateX(${x}px)`,
              gap: 16,
              padding: "10px 16px",
              background: `${colors.bgCard}cc`,
              borderRadius: 10,
              borderLeft: `3px solid ${badgeColor}`,
            }}
          >
            {/* Commit dot */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: badgeColor,
                boxShadow: `0 0 12px ${badgeColor}88`,
                flexShrink: 0,
              }}
            />

            {/* Hash */}
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 14,
                color: colors.textMuted,
                flexShrink: 0,
              }}
            >
              {commit.hash}
            </span>

            {/* Badge */}
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                color: badgeColor,
                background: `${badgeColor}18`,
                padding: "3px 8px",
                borderRadius: 4,
                fontWeight: 700,
                flexShrink: 0,
                letterSpacing: "1px",
              }}
            >
              {typeLabels[commit.type]}
            </span>

            {/* Message */}
            <span
              style={{
                fontFamily: fonts.body,
                fontSize: 16,
                color: colors.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {commit.message}
            </span>
          </div>
        );
      })}
    </div>
  );
};
