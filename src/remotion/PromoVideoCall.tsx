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
// BRAND COLORS
// ============================================
const COLORS = {
  green: "#22c55e",
  greenDark: "#16a34a",
  emerald: "#10b981",
  teal: "#14b8a6",
  white: "#ffffff",
  black: "#000000",
  gray: "#6b7280",
  lightGray: "#f5f5f5",
  text: "#0a0a0a",
  bg: "#ffffff",
  border: "#e5e5e5",
};

const FONT = "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif";

// ============================================
// CHARACTER DATA
// ============================================
interface Character {
  name: string;
  skinTone: string;
  hairColor: string;
  hairStyle: "curly" | "short" | "long" | "fade" | "bob";
  accessory?: "glasses" | "earrings" | "headphones" | "beanie";
  shirtColor: string;
}

interface SceneConfig {
  character: Character;
  bgColors: string[];
  envElements: string;
  callingFrom: string;
  quote: string;
  quoteStyle: "excited" | "mindblown" | "analytical" | "hyped" | "urgent";
  callDirection: "outgoing" | "incoming";
  contactName: string;
}

const SCENES: SceneConfig[] = [
  {
    character: {
      name: "Maya",
      skinTone: "#8D5524",
      hairColor: "#1a1a2e",
      hairStyle: "curly",
      accessory: "earrings",
      shirtColor: "#7c3aed",
    },
    bgColors: ["#ffffff", "#f0fdf4", "#dcfce7"],
    envElements: "apartment-night",
    callingFrom: "Her apartment, 11:47 PM",
    quote:
      "YOOO have you seen this?? It's called App Market — I just listed my dashboard template and someone already bid on it!!",
    quoteStyle: "excited",
    callDirection: "outgoing",
    contactName: "Jordan",
  },
  {
    character: {
      name: "Jordan",
      skinTone: "#FDBCB4",
      hairColor: "#C4552D",
      hairStyle: "short",
      shirtColor: "#059669",
    },
    bgColors: ["#ffffff", "#ecfdf5", "#d1fae5"],
    envElements: "coffee-shop",
    callingFrom: "Café Voltaire, 2:15 PM",
    quote:
      "Wait wait wait... you're telling me I can sell all those side projects sitting in my GitHub?? BRO.",
    quoteStyle: "mindblown",
    callDirection: "incoming",
    contactName: "Maya",
  },
  {
    character: {
      name: "Priya",
      skinTone: "#C68642",
      hairColor: "#0a0a0a",
      hairStyle: "long",
      accessory: "glasses",
      shirtColor: "#2563eb",
    },
    bgColors: ["#ffffff", "#f0fdf4", "#ccfbf1"],
    envElements: "coworking",
    callingFrom: "WeWork Bangalore, 6:30 PM",
    quote:
      "Escrow on Solana. Instant settlement. GitHub-verified ownership. This is exactly what the vibe coding era needed.",
    quoteStyle: "analytical",
    callDirection: "incoming",
    contactName: "Jordan",
  },
  {
    character: {
      name: "Marcus",
      skinTone: "#4A2C17",
      hairColor: "#1a1a1a",
      hairStyle: "fade",
      accessory: "headphones",
      shirtColor: "#dc2626",
    },
    bgColors: ["#ffffff", "#f0fdf4", "#dcfce7"],
    envElements: "garage-setup",
    callingFrom: "His garage, 9:00 PM",
    quote:
      "Fam. I just made more selling my weather app on App Market than I did in 6 months of freelancing. I'm NOT joking.",
    quoteStyle: "hyped",
    callDirection: "incoming",
    contactName: "Priya",
  },
  {
    character: {
      name: "Aiko",
      skinTone: "#F1C27D",
      hairColor: "#1a1a2e",
      hairStyle: "bob",
      shirtColor: "#f97316",
    },
    bgColors: ["#ffffff", "#ecfdf5", "#d1fae5"],
    envElements: "rooftop-sunset",
    callingFrom: "Rooftop, Shibuya, 7:45 PM",
    quote:
      "Everyone's sleeping on this. I listed three vibe-coded projects yesterday. All three got offers TODAY. Go to appmrkt.xyz. Now.",
    quoteStyle: "urgent",
    callDirection: "incoming",
    contactName: "Marcus",
  },
];

// ============================================
// AVATAR COMPONENT (SVG-based character)
// ============================================
const Avatar: React.FC<{
  character: Character;
  size?: number;
  animate?: boolean;
  frame?: number;
  fps?: number;
}> = ({ character, size = 200, animate = false, frame = 0, fps = 30 }) => {
  const headBob = animate
    ? Math.sin((frame / fps) * 3) * 3
    : 0;

  const s = size / 200; // scale factor

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transform: `translateY(${headBob}px)`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 200 200">
        {/* Body / Shirt - green outline, white fill */}
        <ellipse
          cx="100"
          cy="195"
          rx="65"
          ry="40"
          fill="#ffffff"
          stroke={COLORS.green}
          strokeWidth="2.5"
        />

        {/* Neck */}
        <rect
          x="88"
          y="130"
          width="24"
          height="30"
          rx="8"
          fill="#ffffff"
          stroke={COLORS.green}
          strokeWidth="2"
        />

        {/* Head */}
        <ellipse
          cx="100"
          cy="100"
          rx="52"
          ry="58"
          fill="#ffffff"
          stroke={COLORS.green}
          strokeWidth="2.5"
        />

        {/* No hair - clean head only */}

        {/* Eyes - green outline */}
        <ellipse cx="80" cy="102" rx="6" ry="7" fill="none" stroke={COLORS.green} strokeWidth="2" />
        <ellipse cx="120" cy="102" rx="6" ry="7" fill="none" stroke={COLORS.green} strokeWidth="2" />

        {/* Eyebrows */}
        <line x1="72" y1="90" x2="88" y2="88" stroke={COLORS.green} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="112" y1="88" x2="128" y2="90" stroke={COLORS.green} strokeWidth="2.5" strokeLinecap="round" />

        {/* Smile */}
        <path
          d="M 82 120 Q 100 138 118 120"
          stroke={COLORS.green}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Nose */}
        <path
          d="M 100 106 Q 96 116 100 118 Q 104 116 100 106"
          fill="none"
          stroke={COLORS.green}
          strokeWidth="1.5"
        />

        {/* No accessories - clean heads only */}
      </svg>
    </div>
  );
};

// ============================================
// ENVIRONMENT BACKGROUNDS (white/green theme)
// ============================================
const WhiteEnvBase: React.FC<{
  frame: number;
  accentColor?: string;
  pattern?: "dots" | "lines" | "circles" | "grid" | "waves";
}> = ({ frame, accentColor = COLORS.green, pattern = "dots" }) => {
  const pulse = 0.5 + Math.sin(frame * 0.04) * 0.15;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Subtle gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${accentColor}08 0%, transparent 70%)`,
        }}
      />

      {pattern === "dots" &&
        Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 60 + (i % 5) * 380 + Math.sin(i * 1.3) * 80,
              top: 60 + Math.floor(i / 5) * 260 + Math.cos(i * 0.9) * 60,
              width: 4 + (i % 3) * 3,
              height: 4 + (i % 3) * 3,
              borderRadius: "50%",
              backgroundColor: accentColor,
              opacity: (0.05 + (i % 4) * 0.02) * pulse,
            }}
          />
        ))}

      {pattern === "lines" && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1920 1080">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1={0} y1={100 + i * 130} x2={1920} y2={100 + i * 130} stroke={accentColor} strokeWidth="1" opacity={0.05 * pulse} />
          ))}
        </svg>
      )}

      {pattern === "circles" && (
        <>
          <div style={{ position: "absolute", right: 100, top: 100, width: 300, height: 300, borderRadius: "50%", border: `1.5px solid ${accentColor}`, opacity: 0.06 * pulse }} />
          <div style={{ position: "absolute", left: 80, bottom: 120, width: 220, height: 220, borderRadius: "50%", border: `1.5px solid ${accentColor}`, opacity: 0.05 * pulse }} />
          <div style={{ position: "absolute", right: 350, bottom: 200, width: 160, height: 160, borderRadius: "50%", border: `1.5px solid ${accentColor}`, opacity: 0.04 * pulse }} />
        </>
      )}

      {pattern === "grid" &&
        Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 10 }).map((_, col) => (
            <div
              key={`${row}-${col}`}
              style={{
                position: "absolute",
                left: 100 + col * 180,
                top: 80 + row * 170,
                width: 3,
                height: 3,
                borderRadius: "50%",
                backgroundColor: accentColor,
                opacity: 0.06 * pulse,
              }}
            />
          ))
        )}

      {pattern === "waves" && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 1920 1080">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M 0 ${400 + i * 200} Q 480 ${350 + i * 200 + Math.sin(frame * 0.02 + i) * 30} 960 ${400 + i * 200} Q 1440 ${450 + i * 200 + Math.sin(frame * 0.02 + i) * 30} 1920 ${400 + i * 200}`}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
              opacity={0.05 * pulse}
            />
          ))}
        </svg>
      )}
    </AbsoluteFill>
  );
};

const ApartmentNight: React.FC<{ frame: number }> = ({ frame }) => (
  <WhiteEnvBase frame={frame} accentColor={COLORS.green} pattern="circles" />
);

const CoffeeShop: React.FC<{ frame: number }> = ({ frame }) => (
  <WhiteEnvBase frame={frame} accentColor={COLORS.emerald} pattern="dots" />
);

const CoworkingSpace: React.FC<{ frame: number }> = ({ frame }) => (
  <WhiteEnvBase frame={frame} accentColor={COLORS.teal} pattern="lines" />
);

const GarageSetup: React.FC<{ frame: number }> = ({ frame }) => (
  <WhiteEnvBase frame={frame} accentColor={COLORS.green} pattern="grid" />
);

const RooftopSunset: React.FC<{ frame: number }> = ({ frame }) => (
  <WhiteEnvBase frame={frame} accentColor={COLORS.emerald} pattern="waves" />
);

const EnvironmentBackground: React.FC<{ type: string; frame: number }> = ({
  type,
  frame,
}) => {
  switch (type) {
    case "apartment-night":
      return <ApartmentNight frame={frame} />;
    case "coffee-shop":
      return <CoffeeShop frame={frame} />;
    case "coworking":
      return <CoworkingSpace frame={frame} />;
    case "garage-setup":
      return <GarageSetup frame={frame} />;
    case "rooftop-sunset":
      return <RooftopSunset frame={frame} />;
    default:
      return null;
  }
};

// ============================================
// PHONE UI OVERLAY
// ============================================
const PhoneCallUI: React.FC<{
  contactName: string;
  direction: "outgoing" | "incoming";
  frame: number;
  fps: number;
}> = ({ contactName, direction, frame, fps }) => {
  const slideIn = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const offset = interpolate(slideIn, [0, 1], [100, 0]);
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);

  const pulseOpacity = 0.5 + Math.sin(frame * 0.15) * 0.3;

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: "50%",
        transform: `translateX(-50%) translateY(${offset}px)`,
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 16,
        backgroundColor: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(20px)",
        padding: "14px 28px",
        borderRadius: 60,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      {/* Pulse dot */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: COLORS.green,
          opacity: pulseOpacity,
          boxShadow: `0 0 10px ${COLORS.green}`,
        }}
      />
      {/* Phone icon */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={COLORS.green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      <div>
        <p
          style={{
            fontSize: 12,
            color: COLORS.gray,
            margin: 0,
            fontFamily: FONT,
            fontWeight: 400,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {direction === "outgoing" ? "Calling..." : "Incoming call"}
        </p>
        <p
          style={{
            fontSize: 20, color: COLORS.text, margin: 0, fontFamily: FONT, fontWeight: 600,
          }}
        >
          {contactName}
        </p>
      </div>
    </div>
  );
};

// ============================================
// SPEECH BUBBLE WITH TYPING EFFECT
// ============================================
const SpeechBubble: React.FC<{
  quote: string;
  style: "excited" | "mindblown" | "analytical" | "hyped" | "urgent";
  frame: number;
  fps: number;
  delay: number;
}> = ({ quote, style: quoteStyle, frame, fps, delay }) => {
  const adjustedFrame = frame - delay;
  if (adjustedFrame < 0) return null;

  const slideUp = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const offset = interpolate(slideUp, [0, 1], [60, 0]);
  const opacity = interpolate(slideUp, [0, 1], [0, 1]);

  // Typewriter effect: reveal characters over time
  const charsPerFrame = 1.8;
  const visibleChars = Math.min(
    quote.length,
    Math.floor(adjustedFrame * charsPerFrame)
  );
  const displayedText = quote.slice(0, visibleChars);

  const bubbleColors: Record<string, { bg: string; border: string; text: string }> = {
    excited: { bg: "#7c3aed15", border: "#7c3aed40", text: "#1a1a2e" },
    mindblown: { bg: "#05966915", border: "#05966940", text: "#1a1a2e" },
    analytical: { bg: "#2563eb15", border: "#2563eb40", text: "#1a1a2e" },
    hyped: { bg: "#dc262615", border: "#dc262640", text: "#1a1a2e" },
    urgent: { bg: "#f9731615", border: "#f9731640", text: "#1a1a2e" },
  };

  const colors = bubbleColors[quoteStyle];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: `translateX(-50%) translateY(${offset}px)`,
        opacity,
        maxWidth: 900,
        width: "80%",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          border: `2px solid ${colors.border}`,
          borderRadius: 24,
          padding: "28px 36px",
          boxShadow: `0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px ${colors.border}`,
        }}
      >
        {/* Quote mark */}
        <span
          style={{
            fontSize: 48,
            color: colors.border,
            fontFamily: "Georgia, serif",
            lineHeight: 0.5,
            display: "block",
            marginBottom: 8,
          }}
        >
          &ldquo;
        </span>
        <p
          style={{
            fontSize: 30,
            color: colors.text,
            fontFamily: FONT,
            fontWeight: 500,
            lineHeight: 1.5,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {displayedText}
          {visibleChars < quote.length && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 28,
                backgroundColor: colors.text,
                marginLeft: 2,
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                verticalAlign: "text-bottom",
              }}
            />
          )}
        </p>
      </div>
    </div>
  );
};

// ============================================
// LOCATION TAG
// ============================================
const LocationTag: React.FC<{
  text: string;
  frame: number;
  fps: number;
}> = ({ text, frame, fps }) => {
  const fadeIn = spring({
    frame: frame - 15,
    fps,
    config: { damping: 16, stiffness: 100 },
  });
  const opacity = interpolate(fadeIn, [0, 1], [0, 0.9]);

  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: "50%",
        transform: "translateX(-50%)",
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        padding: "8px 20px",
        borderRadius: 30,
      }}
    >
      {/* Pin icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <p
        style={{
          fontSize: 14,
          color: "#fff",
          margin: 0,
          fontFamily: FONT,
          fontWeight: 400,
          letterSpacing: "0.03em",
        }}
      >
        {text}
      </p>
    </div>
  );
};

// ============================================
// INDIVIDUAL CHARACTER SCENE
// ============================================
const CharacterScene: React.FC<{ sceneIndex: number }> = ({ sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[sceneIndex];

  // Avatar entrance animation
  const avatarSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const avatarScale = interpolate(avatarSpring, [0, 1], [0.6, 1]);
  const avatarOpacity = interpolate(avatarSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      {/* Environment */}
      <EnvironmentBackground type={scene.envElements} frame={frame} />

      {/* Dim overlay for readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.03)",
        }}
      />

      {/* Phone call UI */}
      <PhoneCallUI
        contactName={scene.contactName}
        direction={scene.callDirection}
        frame={frame}
        fps={fps}
      />

      {/* Location tag */}
      <LocationTag text={scene.callingFrom} frame={frame} fps={fps} />

      {/* Character avatar */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -65%) scale(${avatarScale})`,
          opacity: avatarOpacity,
        }}
      >
        <Avatar
          character={scene.character}
          size={280}
          animate={true}
          frame={frame}
          fps={fps}
        />
        {/* Name label */}
        <p
          style={{
            textAlign: "center",
            fontSize: 28, color: COLORS.text, fontFamily: FONT, fontWeight: 700, margin: "12px 0 0 0", textShadow: "none",
          }}
        >
          {scene.character.name}
        </p>
      </div>

      {/* Speech bubble */}
      <SpeechBubble
        quote={scene.quote}
        style={scene.quoteStyle}
        frame={frame}
        fps={fps}
        delay={30}
      />
    </AbsoluteFill>
  );
};

// ============================================
// INTRO SCENE
// ============================================
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ringScale1 = interpolate(frame, [0, 60], [0.5, 2.5], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const ringOpacity1 = interpolate(frame, [0, 60], [0.6, 0], {
    extrapolateRight: "clamp",
  });
  const ringScale2 = interpolate(frame, [15, 75], [0.5, 2.5], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const ringOpacity2 = interpolate(frame, [15, 75], [0.6, 0], {
    extrapolateRight: "clamp",
  });

  const phoneSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150 },
  });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.3, 1]);

  const textSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [30, 0]);

  const subtitleSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);

  // Phone vibration
  const vibrate = frame < 60 ? Math.sin(frame * 2) * 3 : 0;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 50%, #ecfdf5 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Ripple rings */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: `3px solid ${COLORS.green}`,
          transform: `translate(-50%, -60%) scale(${ringScale1})`,
          opacity: ringOpacity1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: `3px solid ${COLORS.emerald}`,
          transform: `translate(-50%, -60%) scale(${ringScale2})`,
          opacity: ringOpacity2,
        }}
      />

      {/* Phone icon */}
      <div
        style={{
          transform: `scale(${phoneScale}) translateX(${vibrate}px)`,
          marginBottom: 40,
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          stroke={COLORS.green}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </div>

      {/* Title text */}
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: 72, color: COLORS.text,
            fontFamily: FONT,
            fontWeight: 300,
            margin: 0,
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            letterSpacing: "-0.02em",
          }}
        >
          Have you heard about
        </h1>
        <h1
          style={{
            fontSize: 110,
            color: COLORS.green,
            fontFamily: FONT,
            fontWeight: 700,
            margin: "10px 0 0 0",
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            letterSpacing: "-0.03em",
          }}
        >
          App Market
        </h1>
        <p
          style={{
            fontSize: 28,
            color: COLORS.gray,
            fontFamily: FONT,
            fontWeight: 400,
            margin: "20px 0 0 0",
            opacity: subtitleOpacity,
          }}
        >
          The word is spreading...
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SPLIT SCREEN ALL CHARACTERS
// ============================================
const AllTogether: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Title */}
      {(() => {
        const titleSpring = spring({
          frame,
          fps,
          config: { damping: 12, stiffness: 120 },
        });
        const opacity = interpolate(titleSpring, [0, 1], [0, 1]);
        const y = interpolate(titleSpring, [0, 1], [30, 0]);
        return (
          <h2
            style={{
              position: "absolute",
              top: 60, fontSize: 52, color: COLORS.text,
              fontFamily: FONT,
              fontWeight: 300,
              margin: 0,
              opacity,
              transform: `translateY(${y}px)`,
              letterSpacing: "-0.01em",
            }}
          >
            Everyone&apos;s talking about it.
          </h2>
        );
      })()}

      {/* Character grid */}
      <div
        style={{
          display: "flex",
          gap: 60,
          marginTop: 40,
        }}
      >
        {SCENES.map((scene, i) => {
          const delay = 10 + i * 8;
          const charSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 10, stiffness: 150 },
          });
          const scale = interpolate(charSpring, [0, 1], [0.4, 1]);
          const opacity = interpolate(charSpring, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity,
                transform: `scale(${scale})`,
              }}
            >
              {/* Environment color card */}
              <div
                style={{
                  width: 180,
                  height: 220,
                  borderRadius: 24,
                  background: `linear-gradient(135deg, ${scene.bgColors[0]}, ${scene.bgColors[2] || scene.bgColors[1]})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `2px solid ${COLORS.border}`,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div style={{ transform: "scale(0.65)", marginTop: 20 }}>
                  <Avatar character={scene.character} size={200} />
                </div>
              </div>
              <p
                style={{
                  fontSize: 22, color: COLORS.text,
                  fontFamily: FONT,
                  fontWeight: 600,
                  margin: "16px 0 0 0",
                }}
              >
                {scene.character.name}
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: COLORS.gray,
                  fontFamily: FONT,
                  fontWeight: 400,
                  margin: "4px 0 0 0",
                }}
              >
                {scene.callingFrom.split(",")[0]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bottom connection line */}
      {(() => {
        const lineWidth = interpolate(frame, [50, 90], [0, 800], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            style={{
              position: "absolute",
              bottom: 120,
              left: "50%",
              width: lineWidth,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${COLORS.green}, transparent)`,
              transform: "translateX(-50%)",
              borderRadius: 2,
            }}
          />
        );
      })()}
    </AbsoluteFill>
  );
};

// ============================================
// CTA SCENE
// ============================================
const CTAFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 120 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const taglineSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const taglineOpacity = interpolate(taglineSpring, [0, 1], [0, 1]);
  const taglineY = interpolate(taglineSpring, [0, 1], [20, 0]);

  const buttonSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const buttonScale = interpolate(buttonSpring, [0, 1], [0.7, 1]);
  const buttonOpacity = interpolate(buttonSpring, [0, 1], [0, 1]);

  const subtextSpring = spring({
    frame: frame - 50,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const subtextOpacity = interpolate(subtextSpring, [0, 1], [0, 1]);

  // Gradient rotation
  const gradAngle = interpolate(frame, [0, 300], [135, 225], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradAngle}deg, #ffffff 0%, #f0fdf4 50%, #ecfdf5 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.green}15 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      <div style={{ textAlign: "center" }}>
        {/* App Market logo */}
        <h1
          style={{
            fontSize: 130,
            fontWeight: 700,
            color: COLORS.green,
            margin: 0,
            fontFamily: FONT,
            letterSpacing: "-0.03em",
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          App Market
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 36, color: COLORS.text, fontFamily: FONT, fontWeight: 400,
            margin: "20px 0 0 0",
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          Sell what you vibe code. Get paid instantly.
        </p>

        {/* CTA button */}
        <div
          style={{
            display: "inline-block",
            padding: "22px 64px",
            background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
            borderRadius: 100,
            marginTop: 50,
            opacity: buttonOpacity,
            transform: `scale(${buttonScale})`,
            boxShadow: `0 12px 40px ${COLORS.green}30`,
          }}
        >
          <p
            style={{
              fontSize: 36,
              color: COLORS.white,
              fontFamily: FONT,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            appmrkt.xyz
          </p>
        </div>

        {/* Subtext */}
        <p
          style={{
            fontSize: 20,
            color: "#6b7280",
            fontFamily: FONT,
            fontWeight: 400,
            margin: "30px 0 0 0",
            opacity: subtextOpacity,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Secured by Solana &middot; Trustless Escrow &middot; Instant Settlement
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// TRANSITION WIPE
// ============================================
const TransitionWipe: React.FC<{
  color?: string;
}> = ({ color = COLORS.green }) => {
  const frame = useCurrentFrame();

  const wipeProgress = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const wipeOut = interpolate(frame, [8, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${(wipeOut) * 100}%`,
          width: `${wipeProgress * 100}%`,
          height: "100%",
          backgroundColor: color,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION - ~50 seconds
// ============================================
export const PromoVideoCall: React.FC = () => {
  // Scene durations in frames (30 fps)
  const INTRO = 120; // 4s
  const CHAR_SCENE = 240; // 8s each
  const ALL_TOGETHER = 150; // 5s
  const CTA = 150; // 5s
  const TRANSITION = 16; // 0.5s

  // Calculate scene start times
  const introStart = 0;
  const char1Start = INTRO;
  const char2Start = char1Start + CHAR_SCENE;
  const char3Start = char2Start + CHAR_SCENE;
  const char4Start = char3Start + CHAR_SCENE;
  const char5Start = char4Start + CHAR_SCENE;
  const allStart = char5Start + CHAR_SCENE;
  const ctaStart = allStart + ALL_TOGETHER;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Intro */}
      <Sequence from={introStart} durationInFrames={INTRO}>
        <IntroScene />
      </Sequence>

      {/* Transition */}
      <Sequence from={INTRO - TRANSITION} durationInFrames={TRANSITION}>
        <TransitionWipe />
      </Sequence>

      {/* Character scenes */}
      {SCENES.map((_, i) => {
        const start = char1Start + i * CHAR_SCENE;
        return (
          <React.Fragment key={i}>
            <Sequence from={start} durationInFrames={CHAR_SCENE}>
              <CharacterScene sceneIndex={i} />
            </Sequence>
            {/* Transition between scenes */}
            <Sequence
              from={start + CHAR_SCENE - TRANSITION}
              durationInFrames={TRANSITION}
            >
              <TransitionWipe
                color={
                  SCENES[Math.min(i + 1, SCENES.length - 1)].bgColors[0]
                }
              />
            </Sequence>
          </React.Fragment>
        );
      })}

      {/* All together */}
      <Sequence from={allStart} durationInFrames={ALL_TOGETHER}>
        <AllTogether />
      </Sequence>

      {/* Transition to CTA */}
      <Sequence from={ctaStart - TRANSITION} durationInFrames={TRANSITION}>
        <TransitionWipe color={COLORS.green} />
      </Sequence>

      {/* CTA */}
      <Sequence from={ctaStart} durationInFrames={CTA}>
        <CTAFinal />
      </Sequence>
    </AbsoluteFill>
  );
};
