import {
  AbsoluteFill,
  Audio,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  Easing,
  staticFile,
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
  dark: "#ffffff",
  darkAlt: "#f5f5f5",
  white: "#ffffff",
  red: "#ef4444",
  gray: "#6b7280",
  dimGreen: "#22c55e20",
  text: "#0a0a0a",
  bg: "#ffffff",
  border: "#e5e5e5",
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
        background: `linear-gradient(135deg, ${COLORS.green}cc, ${COLORS.emerald}cc)`,
        opacity: progress * 0.85,
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
        background: `radial-gradient(ellipse at 50% 80%, ${COLORS.green}08 0%, ${COLORS.bg} 70%)`,
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
            background: `${COLORS.darkAlt}cc`,
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
            background: `${COLORS.darkAlt}cc`,
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
      filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.08))`,
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

  // Stick figure center
  const cx = 160 + headTilt * 0.5;
  const headY = 85 + headBob + headTilt * 0.2;
  const neckY = headY + 30;
  const shoulderY = neckY + 15 + shoulderDrop;
  const hipY = shoulderY + 70;
  const spineX = cx + bodyLean;

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
        {/* Head */}
        <circle
          cx={cx}
          cy={headY}
          r="30"
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
        />

        {/* Eyes - two dots */}
        <circle cx={cx - 10} cy={headY - 3} r="2.5" fill={strokeColor} />
        <circle cx={cx + 10} cy={headY - 3} r="2.5" fill={strokeColor} />

        {/* Mouth */}
        {posture === "composed" && (
          <line
            x1={cx - 8} y1={headY + 10}
            x2={cx + 8} y2={headY + 10}
            stroke={strokeColor} strokeWidth="2" strokeLinecap="round"
          />
        )}
        {posture === "leaning" && (
          <circle cx={cx} cy={headY + 12} r="4" fill="none" stroke={strokeColor} strokeWidth="1.5" />
        )}
        {(posture === "slouched" || posture === "relieved") && (
          <path
            d={`M ${cx - 8} ${headY + 10} Q ${cx} ${headY + 16} ${cx + 8} ${headY + 10}`}
            fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round"
          />
        )}
        {posture === "thumbsup" && (
          <path
            d={`M ${cx - 8} ${headY + 12} Q ${cx} ${headY + 7} ${cx + 8} ${headY + 12}`}
            fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round"
          />
        )}

        {/* Hood */}
        {hoodUp && (
          <path
            d={`M ${cx - 34} ${headY + 20}
                Q ${cx - 34} ${headY - 30} ${cx} ${headY - 38}
                Q ${cx + 34} ${headY - 30} ${cx + 34} ${headY + 20}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
          />
        )}

        {/* Neck - single line */}
        <line
          x1={cx} y1={neckY - 2}
          x2={spineX} y2={shoulderY}
          stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
        />

        {/* Spine / torso - single line */}
        <line
          x1={spineX} y1={shoulderY}
          x2={spineX} y2={hipY}
          stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
        />

        {/* Arms */}
        {posture !== "relieved" && posture !== "thumbsup" && (
          <>
            {/* Left arm */}
            <line
              x1={spineX} y1={shoulderY}
              x2={spineX - 45} y2={shoulderY + 30 + bodyLean}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
            {/* Right arm */}
            <line
              x1={spineX} y1={shoulderY}
              x2={spineX + 45} y2={shoulderY + 30 + bodyLean}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
          </>
        )}
        {posture === "relieved" && (
          <>
            {/* Arms hanging down */}
            <line
              x1={spineX} y1={shoulderY}
              x2={spineX - 35} y2={hipY + 10}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
            <line
              x1={spineX} y1={shoulderY}
              x2={spineX + 35} y2={hipY + 10}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
          </>
        )}
        {posture === "thumbsup" && (
          <>
            {/* Left arm normal */}
            <line
              x1={spineX} y1={shoulderY}
              x2={spineX - 45} y2={shoulderY + 30}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
            {/* Right arm up for thumbs up */}
            <line
              x1={spineX} y1={shoulderY}
              x2={spineX + 50} y2={shoulderY - 20}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
            {/* Thumb */}
            <line
              x1={spineX + 50} y1={shoulderY - 20}
              x2={spineX + 50} y2={shoulderY - 40}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
            />
          </>
        )}

        {/* Legs */}
        <line
          x1={spineX} y1={hipY}
          x2={spineX - 35} y2={hipY + 55}
          stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
        />
        <line
          x1={spineX} y1={hipY}
          x2={spineX + 35} y2={hipY + 55}
          stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
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
      bottom: 80,
      left: "50%",
      transform: "translateX(-50%)",
      width: 800,
      height: 240,
    }}
  >
    <svg width="800" height="240" viewBox="0 0 800 240">
      {/* Desk surface - thick slab */}
      <rect x="30" y="100" width="740" height="14" rx="3" fill="none" stroke={COLORS.green} strokeWidth="1.5" opacity="0.35" />
      {/* Wood grain lines */}
      <line x1="60" y1="104" x2="740" y2="104" stroke={COLORS.green} strokeWidth="0.5" opacity="0.08" />
      <line x1="60" y1="107" x2="740" y2="107" stroke={COLORS.green} strokeWidth="0.5" opacity="0.06" />
      <line x1="60" y1="110" x2="740" y2="110" stroke={COLORS.green} strokeWidth="0.5" opacity="0.08" />
      {/* Drawer panel */}
      <rect x="300" y="114" width="200" height="40" rx="3" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.15" />
      {/* Drawer handle */}
      <line x1="370" y1="134" x2="430" y2="134" stroke={COLORS.green} strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
      {/* Left legs */}
      <line x1="70" y1="114" x2="70" y2="235" stroke={COLORS.green} strokeWidth="2" opacity="0.3" />
      <line x1="120" y1="114" x2="120" y2="235" stroke={COLORS.green} strokeWidth="2" opacity="0.3" />
      <line x1="70" y1="190" x2="120" y2="190" stroke={COLORS.green} strokeWidth="1" opacity="0.15" />
      {/* Right legs */}
      <line x1="680" y1="114" x2="680" y2="235" stroke={COLORS.green} strokeWidth="2" opacity="0.3" />
      <line x1="730" y1="114" x2="730" y2="235" stroke={COLORS.green} strokeWidth="2" opacity="0.3" />
      <line x1="680" y1="190" x2="730" y2="190" stroke={COLORS.green} strokeWidth="1" opacity="0.15" />

      {/* Monitor */}
      <rect x="290" y="2" width="220" height="140" rx="6" fill="none" stroke={COLORS.green} strokeWidth="1.5" opacity="0.3" />
      {/* Screen inner */}
      <rect x="298" y="10" width="204" height="118" rx="3" fill="none" stroke={COLORS.green} strokeWidth="0.8" opacity="0.15" />
      {/* Window dots */}
      <circle cx="310" cy="20" r="2.5" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" />
      <circle cx="320" cy="20" r="2.5" fill="none" stroke="#eab308" strokeWidth="1" opacity="0.4" />
      <circle cx="330" cy="20" r="2.5" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.4" />
      {/* Code lines on screen */}
      <line x1="310" y1="34" x2="380" y2="34" stroke={COLORS.green} strokeWidth="2" opacity="0.2" strokeLinecap="round" />
      <line x1="318" y1="46" x2="440" y2="46" stroke={COLORS.green} strokeWidth="2" opacity="0.12" strokeLinecap="round" />
      <line x1="318" y1="58" x2="410" y2="58" stroke={COLORS.green} strokeWidth="2" opacity="0.15" strokeLinecap="round" />
      <line x1="310" y1="70" x2="460" y2="70" stroke={COLORS.green} strokeWidth="2" opacity="0.1" strokeLinecap="round" />
      <line x1="318" y1="82" x2="390" y2="82" stroke={COLORS.green} strokeWidth="2" opacity="0.18" strokeLinecap="round" />
      <line x1="318" y1="94" x2="430" y2="94" stroke={COLORS.green} strokeWidth="2" opacity="0.12" strokeLinecap="round" />
      <line x1="310" y1="106" x2="370" y2="106" stroke={COLORS.green} strokeWidth="2" opacity="0.15" strokeLinecap="round" />
      {/* Monitor stand neck */}
      <rect x="388" y="142" width="24" height="20" rx="2" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.25" />
      {/* Monitor stand base */}
      <ellipse cx="400" cy="166" rx="50" ry="6" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.2" />

      {/* Keyboard on desk */}
      <rect x="330" y="86" width="130" height="12" rx="3" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.2" />
      <line x1="338" y1="90" x2="452" y2="90" stroke={COLORS.green} strokeWidth="0.5" opacity="0.1" />
      <line x1="338" y1="94" x2="452" y2="94" stroke={COLORS.green} strokeWidth="0.5" opacity="0.08" />

      {/* Mouse */}
      <rect x="490" y="86" width="16" height="24" rx="8" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.2" />
      <line x1="498" y1="88" x2="498" y2="94" stroke={COLORS.green} strokeWidth="0.5" opacity="0.15" />

      {/* Coffee mug */}
      <rect x="200" y="78" width="22" height="20" rx="2" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.2" />
      <path d="M 222 83 Q 232 83 232 93 Q 232 98 222 98" fill="none" stroke={COLORS.green} strokeWidth="1" opacity="0.15" />
      {/* Steam */}
      <path d="M 207 75 Q 209 68 207 62" fill="none" stroke={COLORS.green} strokeWidth="0.8" opacity="0.1" strokeLinecap="round" />
      <path d="M 215 75 Q 217 66 215 60" fill="none" stroke={COLORS.green} strokeWidth="0.8" opacity="0.08" strokeLinecap="round" />
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
        border: `2px solid ${COLORS.border}`,
        borderRadius: 4,
        background: COLORS.bg,
        overflow: "hidden",
        boxShadow: `0 2px 8px rgba(0,0,0,0.06), inset 0 0 30px ${COLORS.darkAlt}`,
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
        background: COLORS.darkAlt,
        border: `1.5px solid ${COLORS.border}`,
        borderRadius: 8,
        overflow: "hidden",
        fontFamily: MONO,
        fontSize: 14,
        boxShadow: `0 2px 12px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.04)`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 28,
          background: COLORS.bg,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 6,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${COLORS.red}80` }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid #eab30880` }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", border: `1.5px solid ${COLORS.green}80` }} />
        <span style={{ marginLeft: 8, color: COLORS.gray, fontSize: 11 }}>{title}</span>
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
            <div key={i} style={{ color: line.color || COLORS.text, whiteSpace: "pre" }}>
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
      background: COLORS.bg,
      border: `1.5px solid ${COLORS.border}`,
      borderRadius: 16,
      fontFamily: FONT,
      transform: `scale(${scale})`,
      boxShadow: `0 2px 12px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)`,
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
        <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>App Market Dev</div>
        <div style={{ color: COLORS.gray, fontSize: 13 }}>{handle}</div>
      </div>
    </div>
    <div
      style={{
        color: COLORS.text,
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
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "8px 16px",
        whiteSpace: "nowrap",
        boxShadow: `0 2px 8px rgba(0,0,0,0.06)`,
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
    <AbsoluteFill style={{ background: COLORS.bg }}>
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
    { text: "Running deployment preflight checks...", color: COLORS.gray, delay: 55 },
    { text: "  [1/7] Compiling contracts.......... OK", color: COLORS.green, delay: 70 },
    { text: "  [2/7] Running unit tests........... OK", color: COLORS.green, delay: 82 },
    { text: "  [3/7] Integration tests............", color: COLORS.gray, delay: 94 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
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
          color: COLORS.gray,
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
          <div style={{ padding: 6, fontFamily: MONO, fontSize: 7, color: COLORS.gray }}>
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
    <AbsoluteFill style={{ background: COLORS.bg }}>
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
          textShadow: `0 0 20px ${COLORS.red}30`,
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
    <AbsoluteFill style={{ background: COLORS.bg }}>
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
                    : `${COLORS.gray}50`,
                  textShadow: cycleIdx === i ? `0 0 12px ${step === "fail" ? COLORS.red : COLORS.green}30` : "none",
                  transition: "all 0.1s",
                }}
              >
                {step}
              </div>
              {i < cycleSteps.length - 1 && (
                <span style={{ color: `${COLORS.gray}50`, fontFamily: MONO, fontSize: 20 }}>{"->"}</span>
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
          background: `linear-gradient(to bottom, transparent, ${COLORS.border}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5: THE UPDATE (both delays)
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
    { text: "monday delayed. tuesday delayed.", x: 800, startFrame: 65, color: `${COLORS.teal}bb` },
    { text: "take your time king", x: 450, startFrame: 80, color: `${COLORS.emerald}` },
    { text: "0 for 2 this week lmao", x: 1100, startFrame: 95, color: `${COLORS.green}99` },
    { text: "at least he's testing", x: 250, startFrame: 110, color: `${COLORS.teal}99` },
    { text: "two delays is just thorough QA", x: 900, startFrame: 125, color: `${COLORS.emerald}bb` },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
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
          text="small delay x2. monday didn't work. tuesday didn't either. still fixing."
          timestamp="Tuesday 11:58 PM"
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
// SCENE 6: THE TRUTH (3 AM, after second delay)
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
      text: "  All tests passing. Two delays later, but passing.",
      color: COLORS.green,
      delay: 100,
    });
  }

  // Monitor glow is the only light source
  const monitorGlow = 0.15 + Math.sin(frame * 0.05) * 0.05;

  // "two delays. zero shortcuts." appears at the end
  const taglineOpacity = interpolate(frame, [110, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.darkAlt }}>
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
            color: `${COLORS.green}80`,
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

      {/* "two delays. zero shortcuts." */}
      <div
        style={{
          position: "absolute",
          bottom: 320,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: FONT,
          fontSize: 18,
          color: COLORS.gray,
          fontStyle: "italic",
          opacity: taglineOpacity,
          letterSpacing: 0.5,
        }}
      >
        two delays. zero shortcuts.
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
        background: `radial-gradient(ellipse at 50% 50%, ${COLORS.bg} 0%, ${COLORS.darkAlt} 100%)`,
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
            textShadow: `0 0 40px ${COLORS.green}30, 0 0 80px ${COLORS.green}15`,
            lineHeight: 1.1,
          }}
        >
          App Market
        </div>

        {/* URL in green button */}
        <div
          style={{
            display: "inline-block",
            padding: "18px 56px",
            background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
            borderRadius: 100,
            marginTop: 36,
            opacity: tagline1,
            boxShadow: `0 12px 40px ${COLORS.green}30`,
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 32,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: 1,
            }}
          >
            appmrkt.xyz
          </div>
        </div>

        {/* Badge line */}
        <div
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: `${COLORS.green}80`,
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
          <span>Worth The Wait</span>
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
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Background music */}
      <Audio src={staticFile("litesaturation-hard-work-109531.mp3")} volume={0.5} />

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
