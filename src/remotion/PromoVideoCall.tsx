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
// APP MARKET BRAND COLORS
// ============================================
const COLORS = {
  green: "#22c55e",
  greenDark: "#16a34a",
  emerald: "#10b981",
  teal: "#14b8a6",
  white: "#ffffff",
  black: "#000000",
  dark: "#0f0f23",
  darkAlt: "#1a1a2e",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
};

const FONT = "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif";

// ============================================
// CHARACTER DATA - mfers & miladys NFT silhouettes
// ============================================
type NFTType = "mfer" | "milady";

interface NFTCharacter {
  name: string;
  type: NFTType;
  // mfer traits
  hasHeadphones?: boolean;
  hasCig?: boolean;
  hasPipe?: boolean;
  hasBeanie?: boolean;
  hasHoodie?: boolean;
  hasChain?: boolean;
  hasWatch?: boolean;
  eyeType?: "normal" | "shades" | "vr" | "zombie";
  // milady traits
  hairStyle?: "twintails" | "bob" | "long" | "bangs" | "messy";
  hatType?: "beret" | "bow" | "snapback" | "none";
  hasEarrings?: boolean;
  hasGlasses?: boolean;
  hasChoker?: boolean;
}

interface SceneConfig {
  character: NFTCharacter;
  bgGradient: string[];
  envElements: string;
  callingFrom: string;
  quote: string;
  quoteAccent: string;
  callDirection: "outgoing" | "incoming";
  contactName: string;
}

const SCENES: SceneConfig[] = [
  {
    character: {
      name: "mfer_042",
      type: "mfer",
      hasHeadphones: true,
      hasCig: true,
      hasBeanie: true,
      hasChain: true,
      eyeType: "normal",
    },
    bgGradient: [COLORS.dark, COLORS.darkAlt, "#0f3460"],
    envElements: "apartment-night",
    callingFrom: "His apartment, 11:47 PM",
    quote:
      "YOOO have you seen this?? It's called App Market — I just listed my dashboard template and someone already bid on it!!",
    quoteAccent: COLORS.green,
    callDirection: "outgoing",
    contactName: "milady_888",
  },
  {
    character: {
      name: "milady_888",
      type: "milady",
      hairStyle: "twintails",
      hatType: "beret",
      hasEarrings: true,
      hasChoker: true,
    },
    bgGradient: [COLORS.dark, "#0a1628", "#0f2440"],
    envElements: "coffee-shop",
    callingFrom: "Cafe, Shibuya, 2:15 PM",
    quote:
      "Wait wait wait... you're telling me I can sell all those side projects sitting in my GitHub?? This is actually insane.",
    quoteAccent: COLORS.emerald,
    callDirection: "incoming",
    contactName: "mfer_042",
  },
  {
    character: {
      name: "mfer_777",
      type: "mfer",
      hasHeadphones: true,
      hasPipe: true,
      hasHoodie: true,
      eyeType: "shades",
      hasWatch: true,
    },
    bgGradient: [COLORS.dark, "#0a1a0a", "#0f2a0f"],
    envElements: "coworking",
    callingFrom: "WeWork, NYC, 6:30 PM",
    quote:
      "Escrow on Solana. Instant settlement. GitHub-verified ownership. This is exactly what the vibe coding era needed.",
    quoteAccent: COLORS.teal,
    callDirection: "incoming",
    contactName: "milady_888",
  },
  {
    character: {
      name: "milady_420",
      type: "milady",
      hairStyle: "bob",
      hatType: "snapback",
      hasGlasses: true,
      hasChoker: true,
    },
    bgGradient: [COLORS.dark, "#1a0a2e", "#2d1b40"],
    envElements: "garage-setup",
    callingFrom: "Her studio, 9:00 PM",
    quote:
      "I just made more selling my weather app on App Market than I did in 6 months of freelancing. I'm NOT joking.",
    quoteAccent: COLORS.green,
    callDirection: "incoming",
    contactName: "mfer_777",
  },
  {
    character: {
      name: "mfer_069",
      type: "mfer",
      hasHeadphones: true,
      hasCig: true,
      eyeType: "zombie",
      hasChain: true,
      hasWatch: true,
    },
    bgGradient: [COLORS.dark, "#0a0f1a", "#0f1a2e"],
    envElements: "rooftop-sunset",
    callingFrom: "Rooftop, Tokyo, 7:45 PM",
    quote:
      "Everyone's sleeping on this. I listed three vibe-coded projects yesterday. All three got offers TODAY. Go to appmrkt.xyz. Now.",
    quoteAccent: COLORS.emerald,
    callDirection: "incoming",
    contactName: "milady_420",
  },
];

// ============================================
// MFER SILHOUETTE - green outline, no fill
// ============================================
const MferSilhouette: React.FC<{
  character: NFTCharacter;
  size?: number;
  animate?: boolean;
  frame?: number;
  fps?: number;
}> = ({ character, size = 280, animate = false, frame = 0, fps = 30 }) => {
  const headBob = animate ? Math.sin((frame / fps) * 3) * 2 : 0;
  const smokeDrift = animate ? Math.sin((frame / fps) * 2) * 4 : 0;
  const smokeOpacity = animate
    ? 0.4 + Math.sin((frame / fps) * 1.5) * 0.3
    : 0.5;
  const strokeColor = COLORS.green;
  const strokeW = "2.5";
  const glowFilter = `drop-shadow(0 0 6px ${COLORS.green}40)`;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transform: `translateY(${headBob}px)`,
        filter: glowFilter,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 280 280">
        {/* Body / shoulders + arms extending forward (typing posture) */}
        <path
          d="M 90 210 Q 90 185 105 175 L 140 170 L 175 175 Q 190 185 190 210 L 190 260 Q 140 270 90 260 Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
        {/* Arms extending forward */}
        <path
          d="M 95 195 Q 60 200 40 210"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        <path
          d="M 185 195 Q 220 200 240 210"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Neck */}
        <line
          x1="130"
          y1="155"
          x2="130"
          y2="170"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
        <line
          x1="150"
          y1="155"
          x2="150"
          y2="170"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />

        {/* Head - circle */}
        <circle
          cx="140"
          cy="110"
          r="48"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />

        {/* Headphones - iconic mfer trait */}
        {character.hasHeadphones && (
          <>
            <path
              d="M 88 100 Q 88 55 140 55 Q 192 55 192 100"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Left ear cup */}
            <rect
              x="76"
              y="92"
              width="18"
              height="26"
              rx="6"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {/* Right ear cup */}
            <rect
              x="186"
              y="92"
              width="18"
              height="26"
              rx="6"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
          </>
        )}

        {/* Beanie (under headphones) */}
        {character.hasBeanie && (
          <>
            <path
              d="M 94 85 Q 94 58 140 58 Q 186 58 186 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <line
              x1="94"
              y1="85"
              x2="186"
              y2="85"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <circle
              cx="140"
              cy="52"
              r="5"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
          </>
        )}

        {/* Hoodie */}
        {character.hasHoodie && (
          <path
            d="M 100 155 Q 100 140 115 130 Q 125 165 140 170 Q 155 165 165 130 Q 180 140 180 155"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeW}
          />
        )}

        {/* Eyes */}
        {character.eyeType === "normal" && (
          <>
            <circle
              cx="122"
              cy="108"
              r="4"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <circle
              cx="158"
              cy="108"
              r="4"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
          </>
        )}
        {character.eyeType === "shades" && (
          <>
            <rect
              x="108"
              y="102"
              width="28"
              height="14"
              rx="3"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <rect
              x="144"
              y="102"
              width="28"
              height="14"
              rx="3"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <line
              x1="136"
              y1="109"
              x2="144"
              y2="109"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
          </>
        )}
        {character.eyeType === "zombie" && (
          <>
            <circle
              cx="122"
              cy="108"
              r="6"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <circle
              cx="122"
              cy="108"
              r="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <circle
              cx="158"
              cy="108"
              r="6"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <circle
              cx="158"
              cy="108"
              r="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
          </>
        )}
        {character.eyeType === "vr" && (
          <rect
            x="105"
            y="98"
            width="70"
            height="22"
            rx="6"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeW}
          />
        )}

        {/* Mouth - flat line */}
        <line
          x1="128"
          y1="128"
          x2="152"
          y2="128"
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Cigarette */}
        {character.hasCig && (
          <>
            <line
              x1="152"
              y1="128"
              x2="180"
              y2="140"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Smoke wisps */}
            <path
              d={`M 180 140 Q ${185 + smokeDrift} ${130 + smokeDrift} ${182 + smokeDrift * 0.5} 118`}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={smokeOpacity}
            />
            <path
              d={`M 180 140 Q ${190 + smokeDrift * 0.7} ${125 + smokeDrift} ${188 + smokeDrift * 0.3} 110`}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1"
              strokeLinecap="round"
              opacity={smokeOpacity * 0.6}
            />
          </>
        )}

        {/* Pipe */}
        {character.hasPipe && (
          <>
            <path
              d="M 152 128 L 170 128 Q 178 128 178 136 L 178 148 Q 178 156 170 156 L 164 156 Q 156 156 156 148 L 156 136"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={`M 170 148 Q ${175 + smokeDrift} ${135 + smokeDrift} ${172 + smokeDrift * 0.5} 120`}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={smokeOpacity}
            />
          </>
        )}

        {/* Chain necklace */}
        {character.hasChain && (
          <path
            d="M 115 160 Q 120 172 140 176 Q 160 172 165 160"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3 3"
          />
        )}

        {/* 4:20 Watch */}
        {character.hasWatch && (
          <>
            <rect
              x="32"
              y="206"
              width="14"
              height="10"
              rx="2"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <line
              x1="39"
              y1="208"
              x2="39"
              y2="212"
              stroke={strokeColor}
              strokeWidth="1"
            />
            <line
              x1="39"
              y1="212"
              x2="42"
              y2="212"
              stroke={strokeColor}
              strokeWidth="1"
            />
          </>
        )}
      </svg>
    </div>
  );
};

// ============================================
// MILADY SILHOUETTE - green outline, no fill
// ============================================
const MiladySilhouette: React.FC<{
  character: NFTCharacter;
  size?: number;
  animate?: boolean;
  frame?: number;
  fps?: number;
}> = ({ character, size = 280, animate = false, frame = 0, fps = 30 }) => {
  const headBob = animate ? Math.sin((frame / fps) * 2.5) * 2 : 0;
  const strokeColor = COLORS.green;
  const strokeW = "2.5";
  const glowFilter = `drop-shadow(0 0 6px ${COLORS.green}40)`;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transform: `translateY(${headBob}px)`,
        filter: glowFilter,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 280 280">
        {/* Body - small/narrow (chibi proportion) */}
        <path
          d="M 110 200 Q 110 185 120 178 L 140 175 L 160 178 Q 170 185 170 200 L 170 260 Q 140 268 110 260 Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
        {/* Collar / shirt detail */}
        <path
          d="M 120 178 L 140 190 L 160 178"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Neck */}
        <line
          x1="133"
          y1="160"
          x2="133"
          y2="175"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
        <line
          x1="147"
          y1="160"
          x2="147"
          y2="175"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />

        {/* Head - large chibi head */}
        <ellipse
          cx="140"
          cy="105"
          rx="55"
          ry="58"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />

        {/* Hair styles */}
        {character.hairStyle === "twintails" && (
          <>
            {/* Bangs */}
            <path
              d="M 90 85 Q 100 65 140 60 Q 180 65 190 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <path
              d="M 100 85 Q 110 78 120 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <path
              d="M 120 85 Q 130 78 140 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <path
              d="M 140 85 Q 150 78 160 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <path
              d="M 160 85 Q 170 78 180 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            {/* Left twin tail */}
            <path
              d="M 88 100 Q 65 110 55 150 Q 50 170 60 190"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            <path
              d="M 88 100 Q 72 115 65 155 Q 60 175 68 192"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Right twin tail */}
            <path
              d="M 192 100 Q 215 110 225 150 Q 230 170 220 190"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            <path
              d="M 192 100 Q 208 115 215 155 Q 220 175 212 192"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
        {character.hairStyle === "bob" && (
          <>
            <path
              d="M 88 85 Q 100 58 140 54 Q 180 58 192 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <path
              d="M 88 85 Q 82 100 80 130 Q 80 142 90 145"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            <path
              d="M 192 85 Q 198 100 200 130 Q 200 142 190 145"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            {/* Bangs */}
            <path
              d="M 105 85 Q 115 76 125 85 Q 135 76 145 85 Q 155 76 165 85 Q 175 76 185 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </>
        )}
        {character.hairStyle === "long" && (
          <>
            <path
              d="M 88 85 Q 100 58 140 54 Q 180 58 192 85"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <path
              d="M 88 85 Q 78 120 75 170 Q 72 200 80 220"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            <path
              d="M 192 85 Q 202 120 205 170 Q 208 200 200 220"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
          </>
        )}
        {character.hairStyle === "bangs" && (
          <>
            <path
              d="M 88 90 Q 100 62 140 58 Q 180 62 192 90"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {/* Heavy bangs covering forehead */}
            <path
              d="M 92 90 L 92 98 Q 110 92 128 98 Q 146 92 164 98 Q 182 92 188 98 L 188 90"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </>
        )}
        {character.hairStyle === "messy" && (
          <>
            <path
              d="M 86 88 Q 98 55 140 50 Q 182 55 194 88"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            {/* Messy spikes */}
            <line
              x1="100"
              y1="68"
              x2="90"
              y2="48"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="120"
              y1="58"
              x2="115"
              y2="38"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="140"
              y1="52"
              x2="140"
              y2="32"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="160"
              y1="58"
              x2="168"
              y2="38"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="178"
              y1="68"
              x2="190"
              y2="48"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Hats */}
        {character.hatType === "beret" && (
          <ellipse
            cx="140"
            cy="52"
            rx="42"
            ry="16"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeW}
          />
        )}
        {character.hatType === "bow" && (
          <>
            <circle
              cx="180"
              cy="65"
              r="8"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <path
              d="M 172 65 Q 160 55 168 65 Q 160 75 172 65"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <path
              d="M 188 65 Q 200 55 192 65 Q 200 75 188 65"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </>
        )}
        {character.hatType === "snapback" && (
          <>
            <path
              d="M 90 78 Q 100 55 140 50 Q 180 55 190 78"
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <line
              x1="85"
              y1="78"
              x2="195"
              y2="78"
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Brim */}
            <path
              d="M 85 78 Q 80 76 75 80 Q 78 84 85 78"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </>
        )}

        {/* Large anime eyes */}
        <ellipse
          cx="120"
          cy="108"
          rx="12"
          ry="14"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
        {/* Eye highlight */}
        <circle
          cx="115"
          cy="104"
          r="3"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        <ellipse
          cx="160"
          cy="108"
          rx="12"
          ry="14"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
        <circle
          cx="155"
          cy="104"
          r="3"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />

        {/* Glasses */}
        {character.hasGlasses && (
          <>
            <circle
              cx="120"
              cy="108"
              r="18"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <circle
              cx="160"
              cy="108"
              r="18"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
            />
            <line
              x1="138"
              y1="108"
              x2="142"
              y2="108"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </>
        )}

        {/* Tiny mouth */}
        <path
          d="M 134 132 Q 140 136 146 132"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Earrings */}
        {character.hasEarrings && (
          <>
            <line
              x1="86"
              y1="118"
              x2="86"
              y2="130"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <circle
              cx="86"
              cy="133"
              r="4"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <line
              x1="194"
              y1="118"
              x2="194"
              y2="130"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
            <circle
              cx="194"
              cy="133"
              r="4"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
          </>
        )}

        {/* Choker */}
        {character.hasChoker && (
          <path
            d="M 118 158 Q 125 163 140 165 Q 155 163 162 158"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
};

// ============================================
// NFT AVATAR DISPATCHER
// ============================================
const NFTAvatar: React.FC<{
  character: NFTCharacter;
  size?: number;
  animate?: boolean;
  frame?: number;
  fps?: number;
}> = (props) => {
  if (props.character.type === "mfer") {
    return <MferSilhouette {...props} />;
  }
  return <MiladySilhouette {...props} />;
};

// ============================================
// ENVIRONMENT BACKGROUNDS (dark/brand themed)
// ============================================
const ApartmentNight: React.FC<{ frame: number }> = ({ frame }) => {
  const twinkle1 = 0.5 + Math.sin(frame * 0.15) * 0.5;
  const twinkle2 = 0.5 + Math.sin(frame * 0.2 + 1) * 0.5;
  const twinkle3 = 0.5 + Math.sin(frame * 0.12 + 2) * 0.5;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${COLORS.dark} 0%, ${COLORS.darkAlt} 40%, #16213e 100%)`,
        }}
      />
      {/* Window with moonlight */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 80,
          width: 280,
          height: 350,
          border: `2px solid ${COLORS.green}20`,
          borderRadius: 8,
          background: "linear-gradient(180deg, #0a1628 0%, #0f2440 100%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: `2px solid ${COLORS.green}40`,
            boxShadow: `0 0 40px ${COLORS.green}15`,
          }}
        />
        {[
          { x: 30, y: 25 },
          { x: 180, y: 60 },
          { x: 80, y: 90 },
          { x: 200, y: 30 },
          { x: 120, y: 50 },
        ].map((star, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: star.x,
              top: star.y,
              width: 3,
              height: 3,
              borderRadius: "50%",
              backgroundColor: COLORS.green,
              opacity:
                (i % 3 === 0 ? twinkle1 : i % 3 === 1 ? twinkle2 : twinkle3) *
                0.5,
            }}
          />
        ))}
      </div>
      {/* Green ambient glow */}
      <div
        style={{
          position: "absolute",
          left: 100,
          bottom: 200,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.green}08 0%, transparent 70%)`,
        }}
      />
      {/* Matrix-like particles */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 80 + i * 110,
            top: 40 + Math.sin(i * 0.8) * 30,
            width: 4,
            height: 4,
            borderRadius: "50%",
            backgroundColor: COLORS.green,
            opacity: 0.15 + Math.sin(frame * 0.08 + i * 1.2) * 0.15,
            boxShadow: `0 0 8px ${COLORS.green}30`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const CoffeeShop: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${COLORS.dark} 0%, #0a1a0f 40%, #0f2a15 100%)`,
      }}
    />
    {/* Window with green-tinted light */}
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "60%",
        height: "70%",
        background: `linear-gradient(180deg, ${COLORS.green}06 0%, transparent 100%)`,
      }}
    />
    {/* Coffee cup outline */}
    <div style={{ position: "absolute", right: 200, bottom: 180 }}>
      <div
        style={{
          width: 50,
          height: 45,
          borderRadius: "0 0 10px 10px",
          border: `2px solid ${COLORS.green}30`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 5,
          right: -18,
          width: 18,
          height: 25,
          border: `2px solid ${COLORS.green}30`,
          borderLeft: "none",
          borderRadius: "0 10px 10px 0",
        }}
      />
      {/* Steam */}
      <div
        style={{
          position: "absolute",
          top: -25,
          left: 15,
          width: 2,
          height: 20,
          backgroundColor: `${COLORS.green}30`,
          borderRadius: 2,
          transform: `translateY(${Math.sin(frame * 0.1) * 5}px)`,
          opacity: 0.4 + Math.sin(frame * 0.15) * 0.2,
        }}
      />
    </div>
    {/* Table edge */}
    <div
      style={{
        position: "absolute",
        bottom: 140,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: `${COLORS.green}20`,
      }}
    />
    {/* Hanging lights */}
    {[250, 550, 850].map((x, i) => (
      <React.Fragment key={i}>
        <div
          style={{
            position: "absolute",
            left: x,
            top: 0,
            width: 1,
            height: 80 + i * 20,
            backgroundColor: `${COLORS.green}20`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: x - 10,
            top: 95 + i * 20,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${COLORS.green}15 0%, transparent 70%)`,
          }}
        />
      </React.Fragment>
    ))}
  </AbsoluteFill>
);

const CoworkingSpace: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${COLORS.dark} 0%, #0a0f1a 40%, #0f1a2e 100%)`,
      }}
    />
    {/* Monitor */}
    <div style={{ position: "absolute", right: 100, bottom: 200 }}>
      <div
        style={{
          width: 200,
          height: 130,
          borderRadius: 8,
          border: `2px solid ${COLORS.green}25`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 10 + (i % 3) * 8,
              top: 12 + i * 18,
              width: 40 + ((i * 23) % 80),
              height: 3,
              backgroundColor: COLORS.green,
              borderRadius: 2,
              opacity: 0.15 + (i % 2) * 0.1,
            }}
          />
        ))}
      </div>
      <div
        style={{
          width: 4,
          height: 40,
          backgroundColor: `${COLORS.green}20`,
          margin: "0 auto",
        }}
      />
    </div>
    {/* Grid pattern */}
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: i * 140,
          height: 1,
          backgroundColor: `${COLORS.green}06`,
        }}
      />
    ))}
    {Array.from({ length: 14 }).map((_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: i * 140,
          width: 1,
          backgroundColor: `${COLORS.green}06`,
        }}
      />
    ))}
  </AbsoluteFill>
);

const GarageSetup: React.FC<{ frame: number }> = ({ frame }) => {
  const neonPulse = 0.7 + Math.sin(frame * 0.08) * 0.3;
  const neonPulse2 = 0.7 + Math.sin(frame * 0.1 + 1) * 0.3;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.dark} 40%, #1a0a2e 100%)`,
        }}
      />
      {/* LED strip top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.emerald}, ${COLORS.green})`,
          opacity: neonPulse * 0.5,
          boxShadow: `0 0 30px ${COLORS.green}30`,
        }}
      />
      {/* LED strip bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.emerald}, ${COLORS.green}, ${COLORS.emerald})`,
          opacity: neonPulse2 * 0.4,
          boxShadow: `0 0 20px ${COLORS.green}20`,
        }}
      />
      {/* Multiple monitors */}
      {[
        { x: 60, w: 180, h: 120 },
        { x: 280, w: 240, h: 150 },
        { x: 560, w: 180, h: 120 },
      ].map((monitor, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: monitor.x,
            bottom: 240,
            width: monitor.w,
            height: monitor.h,
            borderRadius: 6,
            border: `1.5px solid ${COLORS.green}${i === 1 ? "25" : "15"}`,
            overflow: "hidden",
          }}
        >
          {[0, 1, 2, 3].map((j) => (
            <div
              key={j}
              style={{
                position: "absolute",
                left: 8 + (j % 2) * 6,
                top: 10 + j * 22,
                width: 30 + (((j + i) * 19) % 60),
                height: 3,
                backgroundColor: COLORS.green,
                borderRadius: 2,
                opacity: 0.12 + ((j + i) % 3) * 0.05,
              }}
            />
          ))}
        </div>
      ))}
      {/* Desk */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          left: 20,
          right: 20,
          height: 2,
          backgroundColor: `${COLORS.green}15`,
        }}
      />
    </AbsoluteFill>
  );
};

const RooftopSunset: React.FC<{ frame: number }> = ({ frame }) => {
  const glowPulse = 0.8 + Math.sin(frame * 0.05) * 0.2;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${COLORS.dark} 0%, #0a1a0f 30%, #0f2a15 50%, #0a1628 80%, ${COLORS.dark} 100%)`,
        }}
      />
      {/* Horizon glow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          width: 800,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${COLORS.green}08 0%, transparent 70%)`,
          transform: "translateX(-50%)",
          opacity: glowPulse,
        }}
      />
      {/* City skyline silhouettes */}
      {[
        { x: 0, w: 80, h: 300 },
        { x: 70, w: 60, h: 250 },
        { x: 120, w: 100, h: 380 },
        { x: 210, w: 70, h: 280 },
        { x: 270, w: 90, h: 350 },
        { x: 350, w: 60, h: 240 },
        { x: 400, w: 120, h: 400 },
        { x: 510, w: 80, h: 320 },
        { x: 580, w: 100, h: 360 },
        { x: 670, w: 70, h: 280 },
        { x: 730, w: 110, h: 420 },
        { x: 830, w: 90, h: 300 },
        { x: 910, w: 80, h: 340 },
        { x: 980, w: 100, h: 380 },
        { x: 1070, w: 60, h: 260 },
        { x: 1120, w: 90, h: 350 },
        { x: 1200, w: 110, h: 400 },
        { x: 1300, w: 80, h: 320 },
        { x: 1370, w: 100, h: 370 },
        { x: 1460, w: 70, h: 290 },
        { x: 1520, w: 120, h: 410 },
        { x: 1630, w: 80, h: 330 },
        { x: 1700, w: 100, h: 360 },
        { x: 1790, w: 90, h: 300 },
        { x: 1870, w: 60, h: 270 },
      ].map((bldg, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: bldg.x,
            bottom: 0,
            width: bldg.w,
            height: bldg.h,
            border: `1px solid ${COLORS.green}08`,
            borderBottom: "none",
            borderRadius: "2px 2px 0 0",
          }}
        >
          {Array.from({ length: Math.floor(bldg.h / 40) }).map((_, j) =>
            Array.from({ length: Math.floor(bldg.w / 20) }).map((_, k) => (
              <div
                key={`${j}-${k}`}
                style={{
                  position: "absolute",
                  left: 6 + k * 18,
                  top: 10 + j * 35,
                  width: 6,
                  height: 8,
                  backgroundColor:
                    (i + j + k) % 4 === 0
                      ? `${COLORS.green}12`
                      : `${COLORS.green}05`,
                  borderRadius: 1,
                }}
              />
            ))
          )}
        </div>
      ))}
      {/* Rooftop railing */}
      <div
        style={{
          position: "absolute",
          bottom: 150,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: `${COLORS.green}20`,
        }}
      />
    </AbsoluteFill>
  );
};

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
        backgroundColor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(20px)",
        padding: "14px 28px",
        borderRadius: 60,
        border: `1px solid ${COLORS.green}20`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.4), 0 0 0 1px ${COLORS.green}10`,
      }}
    >
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
            color: `${COLORS.green}80`,
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
            fontSize: 20,
            color: COLORS.white,
            margin: 0,
            fontFamily: FONT,
            fontWeight: 600,
          }}
        >
          {contactName}
        </p>
      </div>
    </div>
  );
};

// ============================================
// SPEECH BUBBLE - dark glass style
// ============================================
const SpeechBubble: React.FC<{
  quote: string;
  accentColor: string;
  frame: number;
  fps: number;
  delay: number;
}> = ({ quote, accentColor, frame, fps, delay }) => {
  const adjustedFrame = frame - delay;
  if (adjustedFrame < 0) return null;

  const slideUp = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const offset = interpolate(slideUp, [0, 1], [60, 0]);
  const opacity = interpolate(slideUp, [0, 1], [0, 1]);

  const charsPerFrame = 1.8;
  const visibleChars = Math.min(
    quote.length,
    Math.floor(adjustedFrame * charsPerFrame)
  );
  const displayedText = quote.slice(0, visibleChars);

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
          backgroundColor: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(20px)",
          border: `1.5px solid ${accentColor}30`,
          borderRadius: 24,
          padding: "28px 36px",
          boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${accentColor}08`,
        }}
      >
        <span
          style={{
            fontSize: 48,
            color: accentColor,
            fontFamily: "Georgia, serif",
            lineHeight: 0.5,
            display: "block",
            marginBottom: 8,
            opacity: 0.6,
          }}
        >
          &ldquo;
        </span>
        <p
          style={{
            fontSize: 30,
            color: COLORS.white,
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
                backgroundColor: COLORS.green,
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
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        padding: "8px 20px",
        borderRadius: 30,
        border: `1px solid ${COLORS.green}15`,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={COLORS.green}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <p
        style={{
          fontSize: 14,
          color: "#9ca3af",
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
// CHARACTER SCENE
// ============================================
const CharacterScene: React.FC<{ sceneIndex: number }> = ({ sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = SCENES[sceneIndex];

  const avatarSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const avatarScale = interpolate(avatarSpring, [0, 1], [0.6, 1]);
  const avatarOpacity = interpolate(avatarSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <EnvironmentBackground type={scene.envElements} frame={frame} />

      <PhoneCallUI
        contactName={scene.contactName}
        direction={scene.callDirection}
        frame={frame}
        fps={fps}
      />
      <LocationTag text={scene.callingFrom} frame={frame} fps={fps} />

      {/* NFT character silhouette */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -65%) scale(${avatarScale})`,
          opacity: avatarOpacity,
        }}
      >
        <NFTAvatar
          character={scene.character}
          size={320}
          animate={true}
          frame={frame}
          fps={fps}
        />
        {/* Name label */}
        <p
          style={{
            textAlign: "center",
            fontSize: 24,
            color: COLORS.green,
            fontFamily: "SF Mono, monospace",
            fontWeight: 600,
            margin: "8px 0 0 0",
            textShadow: `0 0 20px ${COLORS.green}40`,
            letterSpacing: "0.05em",
          }}
        >
          {scene.character.name}
        </p>
      </div>

      <SpeechBubble
        quote={scene.quote}
        accentColor={scene.quoteAccent}
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

  const vibrate = frame < 60 ? Math.sin(frame * 2) * 3 : 0;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkAlt} 50%, #16213e 100%)`,
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
          border: `2px solid ${COLORS.green}`,
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
          border: `2px solid ${COLORS.emerald}`,
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

      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: 72,
            color: COLORS.white,
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
            textShadow: `0 0 60px ${COLORS.green}30`,
          }}
        >
          App Market
        </h1>
        <p
          style={{
            fontSize: 28,
            color: "#6b7280",
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
// ALL TOGETHER SCENE
// ============================================
const AllTogether: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkAlt} 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
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
              top: 60,
              fontSize: 52,
              color: COLORS.white,
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
      <div style={{ display: "flex", gap: 50, marginTop: 40 }}>
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
              <div
                style={{
                  width: 180,
                  height: 220,
                  borderRadius: 24,
                  background: `linear-gradient(135deg, ${scene.bgGradient[0]}, ${scene.bgGradient[2] || scene.bgGradient[1]})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1.5px solid ${COLORS.green}20`,
                  boxShadow: `0 20px 40px rgba(0,0,0,0.3), 0 0 30px ${COLORS.green}05`,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div style={{ transform: "scale(0.55)", marginTop: 10 }}>
                  <NFTAvatar character={scene.character} size={280} />
                </div>
              </div>
              <p
                style={{
                  fontSize: 18,
                  color: COLORS.green,
                  fontFamily: "SF Mono, monospace",
                  fontWeight: 600,
                  margin: "14px 0 0 0",
                  letterSpacing: "0.03em",
                }}
              >
                {scene.character.name}
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "#6b7280",
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

      {/* Connection line */}
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
              height: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.green}60, transparent)`,
              transform: "translateX(-50%)",
              borderRadius: 2,
              boxShadow: `0 0 20px ${COLORS.green}20`,
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

  const gradAngle = interpolate(frame, [0, 300], [135, 225], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradAngle}deg, ${COLORS.dark} 0%, #0a1628 50%, ${COLORS.dark} 100%)`,
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
          background: `radial-gradient(circle, ${COLORS.green}08 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      <div style={{ textAlign: "center" }}>
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
            textShadow: `0 0 80px ${COLORS.green}30`,
          }}
        >
          App Market
        </h1>

        <p
          style={{
            fontSize: 36,
            color: COLORS.white,
            fontFamily: FONT,
            fontWeight: 400,
            margin: "20px 0 0 0",
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          Sell what you vibe code. Get paid instantly.
        </p>

        <div
          style={{
            display: "inline-block",
            padding: "22px 64px",
            background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
            borderRadius: 100,
            marginTop: 50,
            opacity: buttonOpacity,
            transform: `scale(${buttonScale})`,
            boxShadow: `0 20px 60px ${COLORS.green}40`,
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

        <p
          style={{
            fontSize: 20,
            color: "#4b5563",
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
          left: `${wipeOut * 100}%`,
          width: `${wipeProgress * 100}%`,
          height: "100%",
          backgroundColor: color,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================
export const PromoVideoCall: React.FC = () => {
  const INTRO = 120;
  const CHAR_SCENE = 240;
  const ALL_TOGETHER = 150;
  const CTA = 150;
  const TRANSITION = 16;

  const char1Start = INTRO;
  const allStart = char1Start + SCENES.length * CHAR_SCENE;
  const ctaStart = allStart + ALL_TOGETHER;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <Sequence from={0} durationInFrames={INTRO}>
        <IntroScene />
      </Sequence>
      <Sequence from={INTRO - TRANSITION} durationInFrames={TRANSITION}>
        <TransitionWipe />
      </Sequence>

      {SCENES.map((_, i) => {
        const start = char1Start + i * CHAR_SCENE;
        return (
          <React.Fragment key={i}>
            <Sequence from={start} durationInFrames={CHAR_SCENE}>
              <CharacterScene sceneIndex={i} />
            </Sequence>
            <Sequence
              from={start + CHAR_SCENE - TRANSITION}
              durationInFrames={TRANSITION}
            >
              <TransitionWipe
                color={
                  SCENES[Math.min(i + 1, SCENES.length - 1)].bgGradient[0]
                }
              />
            </Sequence>
          </React.Fragment>
        );
      })}

      <Sequence from={allStart} durationInFrames={ALL_TOGETHER}>
        <AllTogether />
      </Sequence>
      <Sequence from={ctaStart - TRANSITION} durationInFrames={TRANSITION}>
        <TransitionWipe color={COLORS.dark} />
      </Sequence>
      <Sequence from={ctaStart} durationInFrames={CTA}>
        <CTAFinal />
      </Sequence>
    </AbsoluteFill>
  );
};
