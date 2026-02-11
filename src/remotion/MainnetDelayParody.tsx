import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  Easing,
} from "remotion";
import React from "react";

// ============================================
// BRAND TOKENS
// ============================================
const COLORS = {
  green: "#22c55e",
  greenDark: "#16a34a",
  emerald: "#10b981",
  teal: "#14b8a6",
  dark: "#0f0f23",
  darkAlt: "#1a1a2e",
  white: "#ffffff",
  red: "#ef4444",
  gray: "#6b7280",
  dimGreen: "#22c55e20",
};

const FONT = "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "SF Mono, monospace";

// ============================================
// SCENE TIMING (frames at 30fps)
// ============================================
const SCENE = {
  announcement: { start: 0, duration: 150 },       // ~5s
  mondayMorning: { start: 150, duration: 120 },     // ~4s
  discovery: { start: 270, duration: 150 },          // ~5s
  fixLoop: { start: 420, duration: 240 },            // ~8s
  update: { start: 660, duration: 180 },             // ~6s  (bumped slightly for breathing room)
  truth: { start: 840, duration: 150 },              // ~5s
  punchline: { start: 990, duration: 160 },          // ~5.3s
};

const TOTAL_FRAMES = 1150;

// ============================================
// TRANSITION: green wipe overlay
// ============================================
const GreenWipe: React.FC<{ triggerFrame: number }> = ({ triggerFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - triggerFrame;
  if (localFrame < -5 || localFrame > 20) return null;

  const progress = interpolate(localFrame, [-5, 5, 10, 20], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.green}dd, ${COLORS.emerald}dd)`,
        opacity: progress,
        zIndex: 100,
      }}
    />
  );
};

// ============================================
// SERVER ROOM BACKGROUND
// ============================================
const ServerRoom: React.FC<{ dimLevel?: number }> = ({ dimLevel = 0 }) => {
  const frame = useCurrentFrame();

  const blinkRate = (idx: number) =>
    Math.sin((frame * 0.15 + idx * 2.7) % (Math.PI * 2)) > 0.3 ? 1 : 0.2;

  const ambientPulse = 0.6 + Math.sin(frame * 0.03) * 0.15;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 80%, ${COLORS.green}08 0%, ${COLORS.dark} 70%)`,
        opacity: 1 - dimLevel * 0.5,
      }}
    >
      {/* Server racks - left side */}
      {[0, 1, 2].map((rack) => (
        <div
          key={`rack-l-${rack}`}
          style={{
            position: "absolute",
            left: 40 + rack * 110,
            top: 120,
            width: 90,
            height: 600,
            border: `1px solid ${COLORS.green}25`,
            borderRadius: 4,
            background: `${COLORS.dark}cc`,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 8,
                top: 15 + i * 48,
                width: 74,
                height: 38,
                border: `1px solid ${COLORS.green}18`,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 6px",
              }}
            >
              {[0, 1, 2].map((led) => (
                <div
                  key={led}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: COLORS.green,
                    opacity: blinkRate(rack * 36 + i * 3 + led) * ambientPulse,
                    boxShadow: `0 0 4px ${COLORS.green}`,
                  }}
                />
              ))}
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: `${COLORS.green}15`,
                  marginLeft: 4,
                }}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Server racks - right side */}
      {[0, 1, 2].map((rack) => (
        <div
          key={`rack-r-${rack}`}
          style={{
            position: "absolute",
            right: 40 + rack * 110,
            top: 140,
            width: 90,
            height: 560,
            border: `1px solid ${COLORS.green}20`,
            borderRadius: 4,
            background: `${COLORS.dark}cc`,
          }}
        >
          {Array.from({ length: 11 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 8,
                top: 12 + i * 48,
                width: 74,
                height: 38,
                border: `1px solid ${COLORS.green}15`,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 6px",
              }}
            >
              {[0, 1].map((led) => (
                <div
                  key={led}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: led === 0 ? COLORS.green : COLORS.teal,
                    opacity: blinkRate(50 + rack * 22 + i * 2 + led) * ambientPulse,
                    boxShadow: `0 0 3px ${COLORS.green}`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* Cables */}
      <svg
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 1920 1080"
      >
        <path d="M 380 200 Q 500 150 620 280" fill="none" stroke={`${COLORS.green}12`} strokeWidth="2" />
        <path d="M 1540 180 Q 1400 120 1300 300" fill="none" stroke={`${COLORS.green}10`} strokeWidth="2" />
        <path d="M 400 700 Q 960 750 1520 700" fill="none" stroke={`${COLORS.green}08`} strokeWidth="1.5" />
      </svg>

      {/* Floor reflection / ambient glow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(to top, ${COLORS.green}06, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// ENERGY DRINK CAN SVG
// ============================================
const EnergyDrinkCan: React.FC<{
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  tipped?: boolean;
}> = ({ x, y, rotation = 0, opacity = 1, tipped = false }) => (
  <svg
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `rotate(${tipped ? 75 + rotation : rotation}deg)`,
      opacity,
      filter: `drop-shadow(0 0 3px ${COLORS.green}30)`,
    }}
    width="28"
    height="56"
    viewBox="0 0 28 56"
  >
    <rect x="2" y="6" width="24" height="44" rx="4" fill="none" stroke={COLORS.green} strokeWidth="1.5" />
    <rect x="2" y="6" width="24" height="8" rx="4" fill="none" stroke={COLORS.green} strokeWidth="1.5" />
    <path d="M 8 3 Q 14 0 20 3" fill="none" stroke={COLORS.green} strokeWidth="1" />
    <text x="14" y="35" textAnchor="middle" fill={COLORS.green} fontSize="7" fontFamily={MONO} fontWeight="bold">
      NRG
    </text>
  </svg>
);

// ============================================
// DEV SILHOUETTE - green stroke, no fill
// mfers-style: hood up, headphones around neck, slouched at desk
// ============================================
const DevSilhouette: React.FC<{
  size?: number;
  frame?: number;
  fps?: number;
  posture?: "composed" | "leaning" | "slouched" | "relieved" | "thumbsup";
  hoodUp?: boolean;
}> = ({ size = 320, frame = 0, fps = 30, posture = "composed", hoodUp = true }) => {
  const breathe = Math.sin((frame / fps) * 2) * 1.5;
  const headBob = Math.sin((frame / fps) * 1.8) * 1;
  const strokeColor = COLORS.green;
  const sw = "2.5";
  const glowFilter = `drop-shadow(0 0 8px ${COLORS.green}50)`;

  // Posture offsets
  const headTilt = posture === "leaning" ? 8 : posture === "slouched" ? -5 : posture === "relieved" ? -12 : 0;
  const bodyLean = posture === "leaning" ? 6 : posture === "slouched" ? -3 : 0;
  const shoulderDrop = posture === "relieved" ? 8 : posture === "slouched" ? 4 : 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        filter: glowFilter,
        transform: `translateY(${breathe}px)`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 320 320">
        {/* Chair back */}
        <path
          d="M 100 280 Q 95 230 100 200 Q 115 180 160 175 Q 205 180 220 200 Q 225 230 220 280"
          fill="none"
          stroke={`${strokeColor}30`}
          strokeWidth="2"
        />

        {/* Body / torso */}
        <path
          d={`M 110 ${225 + shoulderDrop} Q 110 ${200 + shoulderDrop} 125 190
              L 160 ${185 + bodyLean} L 195 190
              Q 210 ${200 + shoulderDrop} 210 ${225 + shoulderDrop}
              L 210 280 Q 160 290 110 280 Z`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
          strokeLinejoin="round"
        />

        {/* Hoodie pocket line */}
        <path
          d={`M 130 ${240 + shoulderDrop} Q 160 ${248 + shoulderDrop} 190 ${240 + shoulderDrop}`}
          fill="none"
          stroke={`${strokeColor}60`}
          strokeWidth="1.5"
        />

        {/* Arms extending to desk */}
        <path
          d={`M 112 ${205 + shoulderDrop} Q 80 ${215 + shoulderDrop} 55 ${230 + bodyLean}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        <path
          d={`M 208 ${205 + shoulderDrop} Q 240 ${215 + shoulderDrop} 265 ${230 + bodyLean}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
          strokeLinecap="round"
        />

        {/* Hands / fingers at keyboard level */}
        {posture !== "relieved" && posture !== "thumbsup" && (
          <>
            <circle cx={52 + bodyLean} cy={232 + bodyLean} r="6" fill="none" stroke={strokeColor} strokeWidth="1.5" />
            <circle cx={268 + bodyLean} cy={232 + bodyLean} r="6" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          </>
        )}

        {/* Thumbs up (right hand) */}
        {posture === "thumbsup" && (
          <g transform="translate(250, 195)">
            <rect x="-6" y="5" width="14" height="20" rx="4" fill="none" stroke={strokeColor} strokeWidth={sw} />
            <rect x="-3" y="-12" width="8" height="20" rx="3" fill="none" stroke={strokeColor} strokeWidth={sw} />
          </g>
        )}

        {/* Relieved - arms dropped */}
        {posture === "relieved" && (
          <>
            <path d="M 112 215 Q 90 250 85 275" fill="none" stroke={strokeColor} strokeWidth={sw} strokeLinecap="round" />
            <path d="M 208 215 Q 230 250 235 275" fill="none" stroke={strokeColor} strokeWidth={sw} strokeLinecap="round" />
          </>
        )}

        {/* Neck */}
        <line x1="150" y1={170 + headTilt * 0.3} x2="150" y2={185 + bodyLean} stroke={strokeColor} strokeWidth={sw} />
        <line x1="170" y1={170 + headTilt * 0.3} x2="170" y2={185 + bodyLean} stroke={strokeColor} strokeWidth={sw} />

        {/* Head */}
        <circle
          cx={160 + headTilt * 0.5}
          cy={125 + headBob + headTilt * 0.2}
          r="48"
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
        />

        {/* Eyes - two dots */}
        <circle cx={145 + headTilt * 0.5} cy={120 + headBob + headTilt * 0.2} r="3" fill="none" stroke={strokeColor} strokeWidth="2" />
        <circle cx={175 + headTilt * 0.5} cy={120 + headBob + headTilt * 0.2} r="3" fill="none" stroke={strokeColor} strokeWidth="2" />

        {/* Mouth - small line, varies by posture */}
        {posture === "composed" && (
          <line
            x1={152 + headTilt * 0.5}
            y1={138 + headBob + headTilt * 0.2}
            x2={168 + headTilt * 0.5}
            y2={138 + headBob + headTilt * 0.2}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
        {posture === "leaning" && (
          <circle
            cx={160 + headTilt * 0.5}
            cy={140 + headBob + headTilt * 0.2}
            r="5"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
        )}
        {(posture === "slouched" || posture === "relieved") && (
          <path
            d={`M ${150 + headTilt * 0.5} ${140 + headBob + headTilt * 0.2} Q ${160 + headTilt * 0.5} ${145 + headBob + headTilt * 0.2} ${170 + headTilt * 0.5} ${140 + headBob + headTilt * 0.2}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
        {posture === "thumbsup" && (
          <path
            d={`M ${150 + headTilt * 0.5} ${137 + headBob} Q ${160 + headTilt * 0.5} ${133 + headBob} ${170 + headTilt * 0.5} ${137 + headBob}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}

        {/* Hood */}
        {hoodUp && (
          <path
            d={`M ${108 + headTilt * 0.5} ${155 + headBob + headTilt * 0.2}
                Q ${108 + headTilt * 0.5} ${80 + headBob + headTilt * 0.2}
                  ${160 + headTilt * 0.5} ${68 + headBob + headTilt * 0.2}
                Q ${212 + headTilt * 0.5} ${80 + headBob + headTilt * 0.2}
                  ${212 + headTilt * 0.5} ${155 + headBob + headTilt * 0.2}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
          />
        )}

        {/* Headphones around neck */}
        <path
          d={`M 130 ${168 + bodyLean} Q 130 ${178 + bodyLean} 145 ${182 + bodyLean}
              L 175 ${182 + bodyLean} Q 190 ${178 + bodyLean} 190 ${168 + bodyLean}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Ear cups dangling */}
        <rect
          x="122"
          y={175 + bodyLean}
          width="14"
          height="14"
          rx="4"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        <rect
          x="184"
          y={175 + bodyLean}
          width="14"
          height="14"
          rx="4"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};

// ============================================
// DESK SVG
// ============================================
const Desk: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: 160,
      left: "50%",
      transform: "translateX(-50%)",
      width: 700,
      height: 40,
    }}
  >
    <svg width="700" height="40" viewBox="0 0 700 40">
      {/* Desk surface */}
      <rect x="0" y="0" width="700" height="8" rx="2" fill="none" stroke={COLORS.green} strokeWidth="2" />
      {/* Legs */}
      <line x1="40" y1="8" x2="40" y2="40" stroke={`${COLORS.green}50`} strokeWidth="2" />
      <line x1="660" y1="8" x2="660" y2="40" stroke={`${COLORS.green}50`} strokeWidth="2" />
    </svg>
  </div>
);

// ============================================
// MONITOR SVG (mini, for background)
// ============================================
const Monitor: React.FC<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: React.ReactNode;
}> = ({ x, y, width = 180, height = 120, content }) => {
  const frame = useCurrentFrame();
  const scanLine = (frame * 2) % height;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        border: `2px solid ${COLORS.green}40`,
        borderRadius: 4,
        background: `${COLORS.dark}ee`,
        overflow: "hidden",
        boxShadow: `0 0 15px ${COLORS.green}15, inset 0 0 30px ${COLORS.dark}`,
      }}
    >
      {content}
      {/* CRT scanline effect */}
      <div
        style={{
          position: "absolute",
          top: scanLine,
          left: 0,
          right: 0,
          height: 2,
          background: `${COLORS.green}08`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// ============================================
// TERMINAL UI
// ============================================
const Terminal: React.FC<{
  lines: Array<{ text: string; color?: string; delay?: number }>;
  width?: number;
  height?: number;
  typeSpeed?: number;
  title?: string;
}> = ({ lines, width = 600, height = 360, typeSpeed = 2, title = "terminal" }) => {
  const frame = useCurrentFrame();

  let accumulatedDelay = 0;

  return (
    <div
      style={{
        width,
        height,
        background: `${COLORS.dark}f5`,
        border: `1.5px solid ${COLORS.green}50`,
        borderRadius: 8,
        overflow: "hidden",
        fontFamily: MONO,
        fontSize: 14,
        boxShadow: `0 0 20px ${COLORS.green}15, 0 4px 30px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 28,
          background: `${COLORS.green}12`,
          borderBottom: `1px solid ${COLORS.green}25`,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 6,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${COLORS.red}80` }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid #eab30880` }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${COLORS.green}80` }} />
        <span style={{ marginLeft: 8, color: `${COLORS.green}60`, fontSize: 11 }}>{title}</span>
      </div>
      {/* Content */}
      <div style={{ padding: "10px 14px", lineHeight: 1.7 }}>
        {lines.map((line, i) => {
          const lineDelay = line.delay ?? accumulatedDelay;
          accumulatedDelay = lineDelay + Math.ceil(line.text.length / typeSpeed) + 3;

          const charsToShow = Math.max(
            0,
            Math.floor((frame - lineDelay) * typeSpeed)
          );
          const visibleText = line.text.slice(0, charsToShow);
          const showCursor = charsToShow > 0 && charsToShow < line.text.length;

          if (frame < lineDelay) return null;

          return (
            <div key={i} style={{ color: line.color || COLORS.green, whiteSpace: "pre" }}>
              {visibleText}
              {showCursor && (
                <span
                  style={{
                    opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                    color: COLORS.green,
                  }}
                >
                  _
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// TWEET / POST CARD
// ============================================
const TweetCard: React.FC<{
  text: string;
  handle?: string;
  timestamp?: string;
  scale?: number;
}> = ({ text, handle = "@appmrkt_dev", timestamp = "just now", scale = 1 }) => (
  <div
    style={{
      width: 520,
      padding: "28px 32px",
      background: `${COLORS.darkAlt}f0`,
      border: `1.5px solid ${COLORS.green}35`,
      borderRadius: 16,
      fontFamily: FONT,
      transform: `scale(${scale})`,
      boxShadow: `0 0 30px ${COLORS.green}10, 0 8px 40px rgba(0,0,0,0.4)`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      {/* Avatar circle */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `2px solid ${COLORS.green}60`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2">
          <circle cx="12" cy="8" r="5" />
          <path d="M 3 21 Q 3 14 12 14 Q 21 14 21 21" />
        </svg>
      </div>
      <div>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 16 }}>App Market Dev</div>
        <div style={{ color: COLORS.gray, fontSize: 13 }}>{handle}</div>
      </div>
    </div>
    <div
      style={{
        color: COLORS.white,
        fontSize: 20,
        lineHeight: 1.5,
        fontWeight: 500,
        letterSpacing: -0.3,
      }}
    >
      {text}
    </div>
    <div style={{ marginTop: 16, color: `${COLORS.gray}aa`, fontSize: 12 }}>{timestamp}</div>
  </div>
);

// ============================================
// FLOATING REACTION BUBBLE
// ============================================
const ReactionBubble: React.FC<{
  text: string;
  x: number;
  startFrame: number;
  speed?: number;
  color?: string;
}> = ({ text, x, startFrame, speed = 1.5, color = COLORS.green }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const y = interpolate(localFrame, [0, 80], [700, -50], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const opacity = interpolate(localFrame, [0, 10, 60, 80], [0, 0.9, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y * speed,
        opacity,
        fontFamily: MONO,
        fontSize: 14,
        color,
        background: `${COLORS.dark}dd`,
        border: `1px solid ${color}30`,
        borderRadius: 12,
        padding: "8px 16px",
        whiteSpace: "nowrap",
        boxShadow: `0 0 10px ${color}10`,
      }}
    >
      {text}
    </div>
  );
};

// ============================================
// CLOCK COMPONENT
// ============================================
const ClockFace: React.FC<{ time: string; label?: string }> = ({ time, label }) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{
        fontFamily: MONO,
        fontSize: 64,
        color: COLORS.green,
        fontWeight: 700,
        letterSpacing: 2,
        textShadow: `0 0 20px ${COLORS.green}40`,
      }}
    >
      {time}
    </div>
    {label && (
      <div
        style={{
          fontFamily: FONT,
          fontSize: 16,
          color: `${COLORS.green}80`,
          marginTop: 4,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    )}
  </div>
);

// ============================================
// SCENE 1: THE ANNOUNCEMENT
// ============================================
const Scene1_Announcement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
    delay: 15,
  });

  const devOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const glowPulse = 0.3 + Math.sin(frame * 0.08) * 0.15;

  return (
    <AbsoluteFill style={{ background: COLORS.dark }}>
      <ServerRoom />

      {/* Central green ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.green}${Math.round(glowPulse * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Tweet card */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: "50%",
          transform: `translateX(-50%) scale(${cardScale})`,
        }}
      >
        <TweetCard
          text="Deploying to mainnet Monday. See you there."
          timestamp="Sunday 11:42 PM"
        />
      </div>

      {/* Dev silhouette, composed */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: devOpacity,
        }}
      >
        <DevSilhouette size={280} frame={frame} fps={fps} posture="composed" hoodUp />
      </div>

      <Desk />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: MONDAY MORNING
// ============================================
const Scene2_MondayMorning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const clockAppear = spring({ frame, fps, config: { damping: 14, stiffness: 100 }, delay: 5 });
  const textAppear = interpolate(frame, [40, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const terminalLines = [
    { text: "$ npm run test:mainnet", color: COLORS.green, delay: 30 },
    { text: "Running deployment preflight checks...", color: `${COLORS.green}aa`, delay: 55 },
    { text: "  [1/7] Compiling contracts.......... OK", color: COLORS.green, delay: 70 },
    { text: "  [2/7] Running unit tests........... OK", color: COLORS.green, delay: 82 },
    { text: "  [3/7] Integration tests............", color: `${COLORS.green}80`, delay: 94 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.dark }}>
      <ServerRoom />

      {/* Clock */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: `translateX(-50%) scale(${clockAppear})`,
        }}
      >
        <ClockFace time="9:00 AM" label="Monday EST" />
      </div>

      {/* Terminal */}
      <div style={{ position: "absolute", top: 200, right: 120 }}>
        <Terminal lines={terminalLines} width={540} height={260} typeSpeed={3} title="deploy-pipeline" />
      </div>

      {/* "Let me just run one more test..." */}
      <div
        style={{
          position: "absolute",
          top: 500,
          right: 140,
          fontFamily: FONT,
          fontSize: 22,
          color: `${COLORS.green}cc`,
          fontStyle: "italic",
          opacity: textAppear,
          letterSpacing: -0.3,
        }}
      >
        "Let me just run one more test..."
      </div>

      {/* Dev at desk */}
      <div style={{ position: "absolute", bottom: 80, left: 160 }}>
        <DevSilhouette size={300} frame={frame} fps={fps} posture="composed" hoodUp />
      </div>

      {/* Single monitor on desk */}
      <Monitor
        x={440}
        y={420}
        width={160}
        height={100}
        content={
          <div style={{ padding: 6, fontFamily: MONO, fontSize: 7, color: `${COLORS.green}60` }}>
            {">"} deploy --network mainnet{"\n"}
            checking...
          </div>
        }
      />

      <Desk />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: THE DISCOVERY
// ============================================
const Scene3_Discovery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const errorLines: Array<{ text: string; color?: string; delay?: number }> = [
    { text: "$ npm run test:mainnet", color: COLORS.green, delay: 0 },
    { text: "  [3/7] Integration tests........... FAIL", color: COLORS.red, delay: 15 },
    { text: "", delay: 20 },
    { text: "  ERROR: Escrow timeout not handled", color: COLORS.red, delay: 22 },
    { text: "  ERROR: Edge case in bid resolution", color: COLORS.red, delay: 30 },
    { text: "  ERROR: Race condition on concurrent bids", color: COLORS.red, delay: 38 },
    { text: "  ERROR: Token transfer reverts on dust amounts", color: COLORS.red, delay: 46 },
    { text: "", delay: 52 },
    { text: "  4 tests failed. Deployment blocked.", color: COLORS.red, delay: 55 },
  ];

  // "oh no" text appearance
  const ohNoProgress = interpolate(frame, [80, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Screen shake on errors
  const shakeX = frame > 15 && frame < 60 ? Math.sin(frame * 2.5) * 3 : 0;
  const shakeY = frame > 15 && frame < 60 ? Math.cos(frame * 3.1) * 2 : 0;

  // Red warning pulse
  const redPulse = frame > 15 ? Math.sin(frame * 0.15) * 0.08 : 0;

  return (
    <AbsoluteFill style={{ background: COLORS.dark }}>
      <ServerRoom />

      {/* Red warning overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `${COLORS.red}`,
          opacity: redPulse,
          pointerEvents: "none",
        }}
      />

      {/* Terminal with errors */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: "50%",
          transform: `translateX(-50%) translate(${shakeX}px, ${shakeY}px)`,
        }}
      >
        <Terminal lines={errorLines} width={650} height={380} typeSpeed={3} title="deploy-pipeline -- ERRORS" />
      </div>

      {/* "oh no" */}
      <div
        style={{
          position: "absolute",
          bottom: 280,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: MONO,
          fontSize: 42,
          color: COLORS.red,
          opacity: ohNoProgress,
          fontWeight: 600,
          letterSpacing: 4,
          textShadow: `0 0 20px ${COLORS.red}50`,
        }}
      >
        oh no
      </div>

      {/* Dev leaning forward */}
      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }}>
        <DevSilhouette size={260} frame={frame} fps={fps} posture="leaning" hoodUp />
      </div>

      <Desk />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: THE FIX LOOP
// ============================================
const Scene4_FixLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENE.fixLoop.duration;

  // Clock cycling through hours -- accelerates
  const timeLabels = [
    "10:00 AM", "11:30 AM", "12:00 PM", "1:15 PM",
    "3:00 PM", "4:45 PM", "6:00 PM", "7:30 PM",
    "9:00 PM", "10:30 PM", "11:45 PM",
  ];

  // Each cycle gets shorter as stress increases
  const cycleBase = 28;
  const cycleAccel = 0.88;
  let accumulated = 0;
  let currentTimeIdx = 0;
  for (let i = 0; i < timeLabels.length; i++) {
    const cycleDuration = Math.max(10, Math.floor(cycleBase * Math.pow(cycleAccel, i)));
    if (frame >= accumulated) currentTimeIdx = i;
    accumulated += cycleDuration;
  }

  const currentTime = timeLabels[Math.min(currentTimeIdx, timeLabels.length - 1)];

  // Fix cycle text
  const cycleSteps = ["fix", "test", "fail"];
  const cycleFrame = frame % 30;
  const cycleIdx = Math.floor(cycleFrame / 10) % 3;
  const currentStep = cycleSteps[cycleIdx];

  // Energy drink count increases with time
  const drinkCount = Math.min(8, Math.floor(frame / 25) + 1);

  // Increasing intensity effect
  const intensity = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: "clamp" });

  // Terminal loop lines
  const loopLines: Array<{ text: string; color?: string; delay?: number }> = [];
  const cycleDurations = [0, 20, 38, 52, 64, 74, 82, 90, 96, 102, 108];
  for (let c = 0; c < Math.min(11, Math.floor(frame / 18) + 1); c++) {
    const status = c === Math.floor(frame / 18) ? currentStep : "fail";
    const color = status === "fail" ? COLORS.red : status === "fix" ? COLORS.teal : COLORS.green;
    loopLines.push({
      text: `[${timeLabels[Math.min(c, timeLabels.length - 1)]}]  fix -> test -> ${status}`,
      color,
      delay: cycleDurations[Math.min(c, cycleDurations.length - 1)],
    });
  }

  return (
    <AbsoluteFill style={{ background: COLORS.dark }}>
      <ServerRoom />

      {/* Left half: clock */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ClockFace time={currentTime} label="Monday EST" />

        {/* Cycle indicator */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          {cycleSteps.map((step, i) => (
            <React.Fragment key={step}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 24,
                  fontWeight: 700,
                  color: cycleIdx === i
                    ? (step === "fail" ? COLORS.red : COLORS.green)
                    : `${COLORS.green}30`,
                  textShadow: cycleIdx === i ? `0 0 12px ${step === "fail" ? COLORS.red : COLORS.green}50` : "none",
                  transition: "all 0.1s",
                }}
              >
                {step}
              </div>
              {i < cycleSteps.length - 1 && (
                <span style={{ color: `${COLORS.green}30`, fontFamily: MONO, fontSize: 20 }}>{"->"}</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Energy drinks accumulating */}
        <div style={{ position: "relative", width: 300, height: 80, marginTop: 50 }}>
          {Array.from({ length: drinkCount }, (_, i) => (
            <EnergyDrinkCan
              key={i}
              x={20 + i * 34}
              y={i % 2 === 0 ? 10 : 0}
              rotation={(i * 7 - 15) % 30}
              tipped={i > 4}
              opacity={interpolate(i, [0, drinkCount], [1, 0.6], { extrapolateRight: "clamp" })}
            />
          ))}
        </div>
      </div>

      {/* Right half: terminal + dev */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
        }}
      >
        {/* Terminal */}
        <div style={{ position: "absolute", top: 80, left: 30 }}>
          <Terminal lines={loopLines} width={520} height={400} typeSpeed={4} title="fix-loop.sh" />
        </div>

        {/* Dev getting more slouched */}
        <div style={{ position: "absolute", bottom: 40, left: 160 }}>
          <DevSilhouette
            size={260}
            frame={frame}
            fps={fps}
            posture={intensity > 0.6 ? "slouched" : "leaning"}
            hoodUp
          />
        </div>
      </div>

      {/* Divider line */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          bottom: "10%",
          left: "50%",
          width: 1,
          background: `linear-gradient(to bottom, transparent, ${COLORS.green}25, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5: THE UPDATE
// ============================================
const Scene5_Update: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
    delay: 10,
  });

  const reactions = [
    { text: "ser wen mainnet", x: 120, startFrame: 50, color: `${COLORS.green}bb` },
    { text: "it's always tomorrow", x: 800, startFrame: 65, color: `${COLORS.teal}bb` },
    { text: "take your time king", x: 450, startFrame: 80, color: `${COLORS.emerald}` },
    { text: "monday (est) (of which week?)", x: 1100, startFrame: 95, color: `${COLORS.green}99` },
    { text: "lmao classic", x: 250, startFrame: 110, color: `${COLORS.teal}99` },
    { text: "at least he's testing", x: 900, startFrame: 125, color: `${COLORS.emerald}bb` },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.dark }}>
      <ServerRoom dimLevel={0.3} />

      {/* New tweet */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: "50%",
          transform: `translateX(-50%) scale(${cardScale})`,
        }}
      >
        <TweetCard
          text="small delay. running some tests. mainnet tomorrow."
          timestamp="Monday 11:58 PM"
        />
      </div>

      {/* Community reactions floating up */}
      {reactions.map((r, i) => (
        <ReactionBubble key={i} text={r.text} x={r.x} startFrame={r.startFrame} color={r.color} />
      ))}

      {/* Dev with thumbs up */}
      <div style={{ position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)" }}>
        <DevSilhouette size={260} frame={frame} fps={fps} posture="thumbsup" hoodUp />
      </div>

      <Desk />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 6: THE TRUTH (3 AM)
// ============================================
const Scene6_Truth: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Count of green checkmarks that appear
  const checksVisible = Math.min(7, Math.floor(frame / 12));

  const checkLines: Array<{ text: string; color?: string; delay?: number }> = [
    { text: "$ npm run test:mainnet --final", color: COLORS.green, delay: 0 },
    { text: "", delay: 10 },
  ];

  const testNames = [
    "Escrow timeout handling",
    "Bid resolution edge cases",
    "Concurrent bid resolution",
    "Dust amount transfers",
    "Full deployment simulation",
    "Mainnet RPC connectivity",
    "Final smoke test",
  ];

  testNames.forEach((name, i) => {
    if (i < checksVisible) {
      checkLines.push({
        text: `  [PASS] ${name}`,
        color: COLORS.green,
        delay: 12 + i * 12,
      });
    }
  });

  if (checksVisible >= 7) {
    checkLines.push({ text: "", delay: 96 });
    checkLines.push({
      text: "  All tests passing. Ready for deployment.",
      color: COLORS.green,
      delay: 100,
    });
  }

  // Monitor glow is the only light source
  const monitorGlow = 0.15 + Math.sin(frame * 0.05) * 0.05;

  // "it's actually better this way" appears at the end
  const taglineOpacity = interpolate(frame, [110, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#050510" }}>
      {/* Very dim server room */}
      <div style={{ opacity: 0.15 }}>
        <ServerRoom dimLevel={0.8} />
      </div>

      {/* Monitor glow on surroundings */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          width: 800,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.green}${Math.round(monitorGlow * 255).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* 3 AM clock */}
      <div style={{ position: "absolute", top: 30, right: 60 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 28,
            color: `${COLORS.green}50`,
            fontWeight: 600,
          }}
        >
          3:14 AM
        </div>
      </div>

      {/* Terminal with all green checks */}
      <div style={{ position: "absolute", top: 120, left: "50%", transform: "translateX(-50%)" }}>
        <Terminal lines={checkLines} width={580} height={360} typeSpeed={4} title="final-tests" />
      </div>

      {/* Dev slouched back, relieved */}
      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }}>
        <DevSilhouette size={260} frame={frame} fps={fps} posture="relieved" hoodUp />
      </div>

      {/* "it's actually better this way" */}
      <div
        style={{
          position: "absolute",
          bottom: 320,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: FONT,
          fontSize: 18,
          color: `${COLORS.green}80`,
          fontStyle: "italic",
          opacity: taglineOpacity,
          letterSpacing: 0.5,
        }}
      >
        it's actually better this way
      </div>

      {/* Scattered energy drinks */}
      <EnergyDrinkCan x={200} y={750} rotation={-20} tipped opacity={0.3} />
      <EnergyDrinkCan x={280} y={770} rotation={45} tipped opacity={0.25} />
      <EnergyDrinkCan x={1550} y={740} rotation={-65} tipped opacity={0.3} />
      <EnergyDrinkCan x={1620} y={760} rotation={10} tipped opacity={0.2} />

      <Desk />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 7: THE PUNCHLINE / CTA
// ============================================
const Scene7_Punchline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
    delay: 10,
  });

  const tagline1 = spring({ frame, fps, config: { damping: 14, stiffness: 80 }, delay: 25 });
  const tagline2 = spring({ frame, fps, config: { damping: 14, stiffness: 80 }, delay: 45 });
  const subtitleOpacity = interpolate(frame, [70, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeOpacity = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowPulse = 0.4 + Math.sin(frame * 0.06) * 0.2;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${COLORS.dark} 0%, #050510 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.green}${Math.round(glowPulse * 20).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ textAlign: "center", transform: `scale(${logoScale})` }}>
        {/* App Market logo text */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 96,
            fontWeight: 800,
            color: COLORS.green,
            letterSpacing: -3,
            textShadow: `0 0 40px ${COLORS.green}40, 0 0 80px ${COLORS.green}20`,
            lineHeight: 1.1,
          }}
        >
          App Market
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 500,
            color: COLORS.white,
            marginTop: 24,
            opacity: tagline1,
            letterSpacing: -0.5,
          }}
        >
          Deploying to mainnet. For real this time.
        </div>

        {/* URL */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: 24,
            color: COLORS.teal,
            marginTop: 20,
            opacity: tagline2,
            letterSpacing: 1,
          }}
        >
          appmrkt.xyz
        </div>

        {/* Badge line */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: `${COLORS.green}60`,
            marginTop: 40,
            opacity: badgeOpacity,
            letterSpacing: 2,
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "center",
            gap: 24,
            alignItems: "center",
          }}
        >
          <span>Secured by Solana</span>
          <span style={{ color: `${COLORS.green}30` }}>|</span>
          <span>Trustless Escrow</span>
          <span style={{ color: `${COLORS.green}30` }}>|</span>
          <span>Actually Tested</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================
export const MainnetDelayParody: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.dark }}>
      {/* Scene 1: The Announcement */}
      <Sequence from={SCENE.announcement.start} durationInFrames={SCENE.announcement.duration}>
        <Scene1_Announcement />
      </Sequence>

      {/* Scene 2: Monday Morning */}
      <Sequence from={SCENE.mondayMorning.start} durationInFrames={SCENE.mondayMorning.duration}>
        <Scene2_MondayMorning />
      </Sequence>

      {/* Scene 3: The Discovery */}
      <Sequence from={SCENE.discovery.start} durationInFrames={SCENE.discovery.duration}>
        <Scene3_Discovery />
      </Sequence>

      {/* Scene 4: The Fix Loop */}
      <Sequence from={SCENE.fixLoop.start} durationInFrames={SCENE.fixLoop.duration}>
        <Scene4_FixLoop />
      </Sequence>

      {/* Scene 5: The Update */}
      <Sequence from={SCENE.update.start} durationInFrames={SCENE.update.duration}>
        <Scene5_Update />
      </Sequence>

      {/* Scene 6: The Truth */}
      <Sequence from={SCENE.truth.start} durationInFrames={SCENE.truth.duration}>
        <Scene6_Truth />
      </Sequence>

      {/* Scene 7: The Punchline / CTA */}
      <Sequence from={SCENE.punchline.start} durationInFrames={SCENE.punchline.duration}>
        <Scene7_Punchline />
      </Sequence>

      {/* Green wipe transitions between scenes */}
      <GreenWipe triggerFrame={SCENE.mondayMorning.start} />
      <GreenWipe triggerFrame={SCENE.discovery.start} />
      <GreenWipe triggerFrame={SCENE.fixLoop.start} />
      <GreenWipe triggerFrame={SCENE.update.start} />
      <GreenWipe triggerFrame={SCENE.truth.start} />
      <GreenWipe triggerFrame={SCENE.punchline.start} />
    </AbsoluteFill>
  );
};
