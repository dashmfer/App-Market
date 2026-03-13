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
// BRAND COLORS & FONT
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
};

const FONT = "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif";

// ============================================
// CHARACTER & SCENE TYPES
// ============================================
interface RealCharacter {
  name: string;
  skinTone: string;
  hairColor: string;
  eyeColor: string;
  style: "zara" | "kai" | "elena" | "devon" | "yuki";
}

interface RealSceneConfig {
  character: RealCharacter;
  bgGradient: string[];
  envType: string;
  callingFrom: string;
  quote: string;
  quoteAccent: string;
  callDirection: "outgoing" | "incoming";
  contactName: string;
}

const SCENES: RealSceneConfig[] = [
  {
    character: {
      name: "Zara",
      skinTone: "#8B6914",
      hairColor: "#1a1a1a",
      eyeColor: "#3d2200",
      style: "zara",
    },
    bgGradient: [COLORS.dark, COLORS.darkAlt, "#0f3460"],
    envType: "apartment-night",
    callingFrom: "Downtown apartment, 11:47 PM",
    quote:
      "YOOO have you seen this?? It's called App Market — you can literally sell apps on the blockchain. I just found it and I'm SHOOK.",
    quoteAccent: COLORS.green,
    callDirection: "outgoing",
    contactName: "Kai",
  },
  {
    character: {
      name: "Kai",
      skinTone: "#F0C090",
      hairColor: "#1a1a1a",
      eyeColor: "#2d1a00",
      style: "kai",
    },
    bgGradient: [COLORS.dark, "#0a1a0f", "#0f2a15"],
    envType: "coffee-shop",
    callingFrom: "Blue Bottle Coffee, 2:15 PM",
    quote:
      "Wait wait wait... you're telling me I can sell all those side projects sitting in my GitHub?? My mind is literally blown right now.",
    quoteAccent: COLORS.emerald,
    callDirection: "incoming",
    contactName: "Zara",
  },
  {
    character: {
      name: "Elena",
      skinTone: "#D4A574",
      hairColor: "#2a1a0a",
      eyeColor: "#3d2a00",
      style: "elena",
    },
    bgGradient: [COLORS.dark, "#0a0f1a", "#0f1a2e"],
    envType: "coworking",
    callingFrom: "Modern coworking space, 6:30 PM",
    quote:
      "Escrow on Solana. Instant settlement. GitHub-verified ownership. This is exactly what the vibe coding era needed.",
    quoteAccent: COLORS.teal,
    callDirection: "incoming",
    contactName: "Kai",
  },
  {
    character: {
      name: "Devon",
      skinTone: "#6B4226",
      hairColor: "#0f0f0f",
      eyeColor: "#1a0f00",
      style: "devon",
    },
    bgGradient: [COLORS.dark, "#1a0a2e", "#2d1b40"],
    envType: "home-studio",
    callingFrom: "Home studio, 9:00 PM",
    quote:
      "I just made more selling my weather app on App Market than I did in 6 months of freelancing. I'm NOT joking.",
    quoteAccent: COLORS.green,
    callDirection: "incoming",
    contactName: "Elena",
  },
  {
    character: {
      name: "Yuki",
      skinTone: "#F5DEB3",
      hairColor: "#0f0a05",
      eyeColor: "#1a0f00",
      style: "yuki",
    },
    bgGradient: [COLORS.dark, "#0a0f1a", "#0f1a2e"],
    envType: "rooftop-bar",
    callingFrom: "Rooftop bar, sunset, 7:45 PM",
    quote:
      "Everyone's sleeping on this. I listed three vibe-coded projects yesterday. All three got offers TODAY. Go to appmrkt.xyz. Now.",
    quoteAccent: COLORS.emerald,
    callDirection: "incoming",
    contactName: "Devon",
  },
];

// ============================================
// REALISTIC SVG AVATARS
// ============================================

const ZaraAvatar: React.FC<{
  size: number;
  frame: number;
  fps: number;
  animate: boolean;
}> = ({ size, frame, fps, animate }) => {
  const bob = animate ? Math.sin((frame / fps) * 2.5) * 2 : 0;
  const s = COLORS.green;
  const skin = "#8B6914";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 380"
      style={{
        transform: `translateY(${bob}px)`,
        filter: `drop-shadow(0 0 8px ${COLORS.green}30)`,
      }}
    >
      {/* Neck */}
      <path
        d="M 135 210 L 135 240 Q 135 248 143 250 L 157 250 Q 165 248 165 240 L 165 210"
        fill={`${skin}40`}
        stroke={s}
        strokeWidth="2"
      />
      {/* Turtleneck body */}
      <path
        d="M 95 260 Q 95 248 110 242 L 135 250 L 150 255 L 165 250 L 190 242 Q 205 248 205 260 L 210 340 Q 210 355 195 360 L 105 360 Q 90 355 90 340 Z"
        fill="none"
        stroke={s}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Turtleneck collar */}
      <path
        d="M 120 242 Q 120 230 150 228 Q 180 230 180 242"
        fill="none"
        stroke={s}
        strokeWidth="2"
      />
      <line x1="120" y1="236" x2="180" y2="236" stroke={s} strokeWidth="1.5" opacity="0.5" />
      {/* Arms */}
      <path
        d="M 95 260 Q 70 275 55 310"
        fill="none"
        stroke={s}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 205 260 Q 230 275 245 310"
        fill="none"
        stroke={s}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Head - oval */}
      <ellipse
        cx="150"
        cy="155"
        rx="58"
        ry="68"
        fill={`${skin}25`}
        stroke={s}
        strokeWidth="2.5"
      />
      {/* Locs hairstyle */}
      {[
        "M 95 120 Q 80 140 78 180 Q 76 200 82 220",
        "M 100 108 Q 82 130 76 170 Q 73 195 78 215",
        "M 110 98 Q 88 118 80 155 Q 76 185 84 210",
        "M 125 90 Q 100 108 90 142 Q 85 170 90 200",
        "M 140 86 Q 118 95 105 128 Q 98 155 102 185",
        "M 155 85 Q 155 90 148 120",
        "M 170 88 Q 185 100 195 135 Q 200 158 196 188",
        "M 185 96 Q 205 115 212 148 Q 216 178 210 205",
        "M 195 108 Q 212 128 218 162 Q 222 190 216 215",
        "M 200 120 Q 218 142 222 175 Q 224 200 218 220",
        "M 205 135 Q 220 155 224 185 Q 225 205 220 222",
      ].map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={s}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.8}
        />
      ))}
      {/* Top of head hair volume */}
      <path
        d="M 92 130 Q 95 75 150 68 Q 205 75 208 130"
        fill="none"
        stroke={s}
        strokeWidth="2.5"
      />
      {/* Hoop earrings */}
      <ellipse cx="92" cy="175" rx="10" ry="14" fill="none" stroke={s} strokeWidth="2" />
      <ellipse cx="208" cy="175" rx="10" ry="14" fill="none" stroke={s} strokeWidth="2" />
      {/* Eyes with detail */}
      <ellipse cx="130" cy="150" rx="10" ry="7" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="132" cy="150" r="3.5" fill={s} opacity="0.7" />
      <circle cx="130" cy="148" r="1.5" fill={COLORS.white} opacity="0.8" />
      <ellipse cx="170" cy="150" rx="10" ry="7" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="172" cy="150" r="3.5" fill={s} opacity="0.7" />
      <circle cx="170" cy="148" r="1.5" fill={COLORS.white} opacity="0.8" />
      {/* Eyebrows */}
      <path d="M 118 138 Q 130 133 142 137" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 158 137 Q 170 133 182 138" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Nose */}
      <path d="M 150 155 Q 146 170 142 175 Q 150 178 158 175 Q 154 170 150 155" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      {/* Mouth - excited smile */}
      <path d="M 133 190 Q 142 200 150 200 Q 158 200 167 190" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 138 192 Q 150 196 162 192" fill="none" stroke={s} strokeWidth="1" opacity="0.5" />
    </svg>
  );
};

const KaiAvatar: React.FC<{
  size: number;
  frame: number;
  fps: number;
  animate: boolean;
}> = ({ size, frame, fps, animate }) => {
  const bob = animate ? Math.sin((frame / fps) * 2) * 1.5 : 0;
  const s = COLORS.green;
  const skin = "#F0C090";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 380"
      style={{
        transform: `translateY(${bob}px)`,
        filter: `drop-shadow(0 0 8px ${COLORS.green}30)`,
      }}
    >
      {/* Neck */}
      <path d="M 138 215 L 138 238 L 162 238 L 162 215" fill={`${skin}30`} stroke={s} strokeWidth="2" />
      {/* Hoodie body */}
      <path
        d="M 90 258 Q 90 245 110 238 L 138 238 L 150 245 L 162 238 L 190 238 Q 210 245 210 258 L 215 345 Q 215 360 200 365 L 100 365 Q 85 360 85 345 Z"
        fill="none"
        stroke={s}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Hoodie pocket */}
      <path d="M 120 310 L 120 335 Q 120 340 125 340 L 175 340 Q 180 340 180 335 L 180 310" fill="none" stroke={s} strokeWidth="1.5" opacity="0.6" />
      {/* Hoodie strings */}
      <line x1="140" y1="252" x2="138" y2="280" stroke={s} strokeWidth="1.5" opacity="0.5" />
      <line x1="160" y1="252" x2="162" y2="280" stroke={s} strokeWidth="1.5" opacity="0.5" />
      {/* Arms */}
      <path d="M 90 258 Q 65 275 50 315" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 210 258 Q 235 275 250 315" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Head */}
      <ellipse cx="150" cy="155" rx="55" ry="62" fill={`${skin}20`} stroke={s} strokeWidth="2.5" />
      {/* Buzz cut - stippled top */}
      <path d="M 98 135 Q 100 88 150 82 Q 200 88 202 135" fill="none" stroke={s} strokeWidth="2.5" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <circle
          key={i}
          cx={115 + (i % 5) * 18}
          cy={95 + Math.floor(i / 5) * 15}
          r="1.2"
          fill={s}
          opacity="0.4"
        />
      ))}
      {/* Round glasses */}
      <circle cx="130" cy="152" rx="20" ry="20" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="172" cy="152" rx="20" ry="20" fill="none" stroke={s} strokeWidth="2" />
      <line x1="150" y1="152" x2="152" y2="152" stroke={s} strokeWidth="2" />
      <line x1="98" y1="148" x2="110" y2="150" stroke={s} strokeWidth="1.5" />
      <line x1="192" y1="150" x2="204" y2="148" stroke={s} strokeWidth="1.5" />
      {/* Eyes behind glasses */}
      <ellipse cx="130" cy="152" rx="6" ry="5" fill="none" stroke={s} strokeWidth="1.5" />
      <circle cx="131" cy="151" r="2.5" fill={s} opacity="0.6" />
      <ellipse cx="172" cy="152" rx="6" ry="5" fill="none" stroke={s} strokeWidth="1.5" />
      <circle cx="173" cy="151" r="2.5" fill={s} opacity="0.6" />
      {/* Eyebrows */}
      <path d="M 115 132 Q 130 128 145 132" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 158 132 Q 172 128 188 132" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Nose */}
      <path d="M 150 158 Q 147 170 144 174 Q 150 176 156 174 Q 153 170 150 158" fill="none" stroke={s} strokeWidth="1.5" />
      {/* Mouth - open surprised */}
      <ellipse cx="150" cy="192" rx="10" ry="7" fill="none" stroke={s} strokeWidth="2" />
    </svg>
  );
};

const ElenaAvatar: React.FC<{
  size: number;
  frame: number;
  fps: number;
  animate: boolean;
}> = ({ size, frame, fps, animate }) => {
  const bob = animate ? Math.sin((frame / fps) * 2.2) * 1.5 : 0;
  const s = COLORS.green;
  const skin = "#D4A574";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 380"
      style={{
        transform: `translateY(${bob}px)`,
        filter: `drop-shadow(0 0 8px ${COLORS.green}30)`,
      }}
    >
      {/* Neck */}
      <path d="M 136 212 L 136 238 L 164 238 L 164 212" fill={`${skin}30`} stroke={s} strokeWidth="2" />
      {/* Blazer body */}
      <path
        d="M 85 255 Q 85 242 108 235 L 136 238 L 150 250 L 164 238 L 192 235 Q 215 242 215 255 L 218 345 Q 218 360 203 365 L 97 365 Q 82 360 82 345 Z"
        fill="none"
        stroke={s}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Blazer lapels */}
      <path d="M 136 238 L 125 265 L 140 290" fill="none" stroke={s} strokeWidth="2" />
      <path d="M 164 238 L 175 265 L 160 290" fill="none" stroke={s} strokeWidth="2" />
      {/* Inner top / V-neck */}
      <path d="M 130 242 L 150 268 L 170 242" fill="none" stroke={s} strokeWidth="1.5" opacity="0.6" />
      {/* Arms */}
      <path d="M 85 255 Q 60 270 48 308" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 215 255 Q 240 270 252 308" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Head */}
      <ellipse cx="150" cy="150" rx="56" ry="65" fill={`${skin}20`} stroke={s} strokeWidth="2.5" />
      {/* Wavy hair */}
      <path d="M 94 130 Q 98 78 150 70 Q 202 78 206 130" fill="none" stroke={s} strokeWidth="2.5" />
      <path d="M 94 130 Q 86 155 82 185 Q 78 210 85 235 Q 88 242 92 245" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 206 130 Q 214 155 218 185 Q 222 210 215 235 Q 212 242 208 245" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Wavy texture */}
      <path d="M 88 160 Q 82 170 84 185" fill="none" stroke={s} strokeWidth="1.5" opacity="0.5" />
      <path d="M 92 175 Q 85 188 87 200" fill="none" stroke={s} strokeWidth="1.5" opacity="0.4" />
      <path d="M 212 160 Q 218 170 216 185" fill="none" stroke={s} strokeWidth="1.5" opacity="0.5" />
      <path d="M 208 175 Q 215 188 213 200" fill="none" stroke={s} strokeWidth="1.5" opacity="0.4" />
      {/* Bangs */}
      <path d="M 105 100 Q 115 90 130 98 Q 140 88 155 96 Q 165 88 178 96 Q 188 90 198 100" fill="none" stroke={s} strokeWidth="2" />
      {/* Smart earrings - geometric */}
      <line x1="94" y1="168" x2="94" y2="178" stroke={s} strokeWidth="1.5" />
      <rect x="88" y="178" width="12" height="12" rx="2" fill="none" stroke={s} strokeWidth="1.5" transform="rotate(45 94 184)" />
      <line x1="206" y1="168" x2="206" y2="178" stroke={s} strokeWidth="1.5" />
      <rect x="200" y="178" width="12" height="12" rx="2" fill="none" stroke={s} strokeWidth="1.5" transform="rotate(45 206 184)" />
      {/* Eyes - sharp, analytical */}
      <path d="M 118 146 Q 130 140 142 146 Q 130 150 118 146" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="130" cy="146" r="3" fill={s} opacity="0.7" />
      <circle cx="129" cy="145" r="1.2" fill={COLORS.white} opacity="0.8" />
      <path d="M 158 146 Q 170 140 182 146 Q 170 150 158 146" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="170" cy="146" r="3" fill={s} opacity="0.7" />
      <circle cx="169" cy="145" r="1.2" fill={COLORS.white} opacity="0.8" />
      {/* Eyebrows - arched */}
      <path d="M 116 135 Q 130 128 144 134" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 156 134 Q 170 128 184 135" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Nose */}
      <path d="M 150 152 Q 147 165 143 170 Q 150 172 157 170 Q 153 165 150 152" fill="none" stroke={s} strokeWidth="1.5" />
      {/* Mouth - slight confident smile */}
      <path d="M 136 186 Q 143 192 150 192 Q 157 192 164 186" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const DevonAvatar: React.FC<{
  size: number;
  frame: number;
  fps: number;
  animate: boolean;
}> = ({ size, frame, fps, animate }) => {
  const bob = animate ? Math.sin((frame / fps) * 3) * 2 : 0;
  const s = COLORS.green;
  const skin = "#6B4226";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 380"
      style={{
        transform: `translateY(${bob}px)`,
        filter: `drop-shadow(0 0 8px ${COLORS.green}30)`,
      }}
    >
      {/* Neck */}
      <path d="M 132 215 L 132 240 L 168 240 L 168 215" fill={`${skin}35`} stroke={s} strokeWidth="2" />
      {/* Graphic tee body - broader shoulders */}
      <path
        d="M 80 258 Q 80 245 105 238 L 132 240 L 150 248 L 168 240 L 195 238 Q 220 245 220 258 L 224 345 Q 224 360 208 365 L 92 365 Q 76 360 76 345 Z"
        fill="none"
        stroke={s}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* T-shirt neckline */}
      <path d="M 125 240 Q 135 250 150 252 Q 165 250 175 240" fill="none" stroke={s} strokeWidth="2" />
      {/* Graphic on tee - abstract circuit pattern */}
      <path d="M 130 290 L 145 290 L 145 305 L 155 305 L 155 290 L 170 290" fill="none" stroke={s} strokeWidth="1.5" opacity="0.4" />
      <circle cx="145" cy="305" r="3" fill="none" stroke={s} strokeWidth="1" opacity="0.3" />
      <circle cx="155" cy="290" r="3" fill="none" stroke={s} strokeWidth="1" opacity="0.3" />
      {/* Arms - muscular */}
      <path d="M 80 258 Q 55 270 40 312" fill="none" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 220 258 Q 245 270 260 312" fill="none" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
      {/* Head - slightly wider jaw */}
      <path
        d="M 94 145 Q 94 88 150 80 Q 206 88 206 145 L 206 165 Q 206 210 150 218 Q 94 210 94 165 Z"
        fill={`${skin}20`}
        stroke={s}
        strokeWidth="2.5"
      />
      {/* Short twists hair */}
      <path d="M 94 135 Q 96 82 150 74 Q 204 82 206 135" fill="none" stroke={s} strokeWidth="2.5" />
      {[
        { x: 112, y: 82, a: -15 },
        { x: 128, y: 76, a: -5 },
        { x: 144, y: 74, a: 0 },
        { x: 160, y: 76, a: 5 },
        { x: 176, y: 80, a: 10 },
        { x: 190, y: 88, a: 18 },
        { x: 106, y: 92, a: -20 },
        { x: 122, y: 84, a: -10 },
        { x: 150, y: 72, a: 0 },
        { x: 168, y: 78, a: 8 },
        { x: 184, y: 84, a: 15 },
        { x: 196, y: 96, a: 22 },
      ].map((t, i) => (
        <line
          key={i}
          x1={t.x}
          y1={t.y}
          x2={t.x + Math.sin((t.a * Math.PI) / 180) * 10}
          y2={t.y - 12}
          stroke={s}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      ))}
      {/* Beard */}
      <path d="M 120 195 Q 120 215 150 222 Q 180 215 180 195" fill="none" stroke={s} strokeWidth="2" opacity="0.7" />
      {/* Beard texture lines */}
      <path d="M 128 198 L 128 212" stroke={s} strokeWidth="1" opacity="0.3" />
      <path d="M 140 200 L 140 218" stroke={s} strokeWidth="1" opacity="0.3" />
      <path d="M 150 200 L 150 220" stroke={s} strokeWidth="1" opacity="0.3" />
      <path d="M 160 200 L 160 218" stroke={s} strokeWidth="1" opacity="0.3" />
      <path d="M 172 198 L 172 212" stroke={s} strokeWidth="1" opacity="0.3" />
      {/* Eyes */}
      <ellipse cx="130" cy="148" rx="10" ry="7" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="132" cy="148" r="3.5" fill={s} opacity="0.7" />
      <circle cx="130" cy="146" r="1.5" fill={COLORS.white} opacity="0.8" />
      <ellipse cx="170" cy="148" rx="10" ry="7" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="172" cy="148" r="3.5" fill={s} opacity="0.7" />
      <circle cx="170" cy="146" r="1.5" fill={COLORS.white} opacity="0.8" />
      {/* Eyebrows - strong */}
      <path d="M 118 135 Q 130 129 142 134" fill="none" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 158 134 Q 170 129 182 135" fill="none" stroke={s} strokeWidth="2.5" strokeLinecap="round" />
      {/* Nose */}
      <path d="M 150 154 Q 146 168 140 173 Q 150 176 160 173 Q 154 168 150 154" fill="none" stroke={s} strokeWidth="1.5" />
      {/* Mouth - big grin (hyped) */}
      <path d="M 130 190 Q 140 202 150 202 Q 160 202 170 190" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 135 192 Q 150 198 165 192" fill={`${s}15`} stroke="none" />
    </svg>
  );
};

const YukiAvatar: React.FC<{
  size: number;
  frame: number;
  fps: number;
  animate: boolean;
}> = ({ size, frame, fps, animate }) => {
  const bob = animate ? Math.sin((frame / fps) * 2.8) * 1.5 : 0;
  const s = COLORS.green;
  const skin = "#F5DEB3";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 380"
      style={{
        transform: `translateY(${bob}px)`,
        filter: `drop-shadow(0 0 8px ${COLORS.green}30)`,
      }}
    >
      {/* Neck */}
      <path d="M 137 210 L 137 235 L 163 235 L 163 210" fill={`${skin}25`} stroke={s} strokeWidth="2" />
      {/* Minimalist top - clean lines */}
      <path
        d="M 90 252 Q 90 240 112 234 L 137 235 L 150 242 L 163 235 L 188 234 Q 210 240 210 252 L 214 345 Q 214 358 200 362 L 100 362 Q 86 358 86 345 Z"
        fill="none"
        stroke={s}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Clean collar line */}
      <line x1="118" y1="238" x2="182" y2="238" stroke={s} strokeWidth="1.5" opacity="0.5" />
      {/* Arms - slender */}
      <path d="M 90 252 Q 68 268 56 305" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 210 252 Q 232 268 244 305" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Head */}
      <ellipse cx="150" cy="148" rx="54" ry="64" fill={`${skin}18`} stroke={s} strokeWidth="2.5" />
      {/* Straight hair with side part */}
      <path d="M 96 128 Q 100 78 150 70 Q 200 78 204 128" fill="none" stroke={s} strokeWidth="2.5" />
      {/* Side part - left side */}
      <path d="M 130 72 Q 128 80 96 128" fill="none" stroke={s} strokeWidth="2" />
      {/* Left side hair falls longer */}
      <path d="M 96 128 Q 88 160 86 195 Q 84 225 88 250" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      <path d="M 100 128 Q 93 158 91 190 Q 89 218 92 242" fill="none" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      {/* Right side shorter */}
      <path d="M 204 128 Q 212 158 214 185 Q 215 210 212 232" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
      {/* Eyes - precise, clean */}
      <path d="M 120 145 Q 130 140 140 145 Q 130 148 120 145" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="130" cy="145" r="3" fill={s} opacity="0.65" />
      <circle cx="129" cy="143" r="1.2" fill={COLORS.white} opacity="0.8" />
      <path d="M 160 145 Q 170 140 180 145 Q 170 148 160 145" fill="none" stroke={s} strokeWidth="2" />
      <circle cx="170" cy="145" r="3" fill={s} opacity="0.65" />
      <circle cx="169" cy="143" r="1.2" fill={COLORS.white} opacity="0.8" />
      {/* Eyebrows - refined */}
      <path d="M 120 135 Q 130 131 140 134" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 160 134 Q 170 131 180 135" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      {/* Nose - delicate */}
      <path d="M 150 150 Q 148 162 145 166 Q 150 168 155 166 Q 152 162 150 150" fill="none" stroke={s} strokeWidth="1.5" />
      {/* Mouth - determined/urgent */}
      <path d="M 140 182 Q 145 186 150 186 Q 155 186 160 182" fill="none" stroke={s} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

// Avatar dispatcher
const RealisticAvatar: React.FC<{
  character: RealCharacter;
  size?: number;
  animate?: boolean;
  frame?: number;
  fps?: number;
}> = ({ character, size = 300, animate = false, frame = 0, fps = 30 }) => {
  const props = { size, frame, fps, animate };
  switch (character.style) {
    case "zara":
      return <ZaraAvatar {...props} />;
    case "kai":
      return <KaiAvatar {...props} />;
    case "elena":
      return <ElenaAvatar {...props} />;
    case "devon":
      return <DevonAvatar {...props} />;
    case "yuki":
      return <YukiAvatar {...props} />;
    default:
      return <ZaraAvatar {...props} />;
  }
};

// ============================================
// ENVIRONMENT BACKGROUNDS - DETAILED
// ============================================

const DowntownApartment: React.FC<{ frame: number }> = ({ frame }) => {
  const twinkle1 = 0.5 + Math.sin(frame * 0.15) * 0.5;
  const twinkle2 = 0.5 + Math.sin(frame * 0.2 + 1) * 0.5;
  const parallax = Math.sin(frame * 0.02) * 3;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #060612 0%, ${COLORS.dark} 30%, ${COLORS.darkAlt} 60%, #16213e 100%)` }} />
      {/* Large window - city view */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 40,
          width: 400,
          height: 480,
          border: `2px solid ${COLORS.green}15`,
          borderRadius: 4,
          overflow: "hidden",
          background: "linear-gradient(180deg, #030308 0%, #0a1628 60%, #0f2440 100%)",
        }}
      >
        {/* Moon */}
        <div style={{ position: "absolute", right: 60, top: 35, width: 50, height: 50, borderRadius: "50%", border: `2px solid ${COLORS.green}35`, boxShadow: `0 0 40px ${COLORS.green}10` }} />
        {/* City buildings through window */}
        {[
          { x: 0, w: 45, h: 200 },
          { x: 40, w: 35, h: 160 },
          { x: 70, w: 55, h: 250 },
          { x: 120, w: 40, h: 180 },
          { x: 155, w: 60, h: 280 },
          { x: 210, w: 45, h: 200 },
          { x: 250, w: 50, h: 230 },
          { x: 295, w: 40, h: 190 },
          { x: 330, w: 55, h: 260 },
          { x: 380, w: 30, h: 170 },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.x + parallax * (i % 3 === 0 ? 0.5 : 0.3),
              bottom: 0,
              width: b.w,
              height: b.h,
              border: `1px solid ${COLORS.green}08`,
              borderBottom: "none",
            }}
          >
            {Array.from({ length: Math.floor(b.h / 30) }).map((_, j) =>
              Array.from({ length: Math.floor(b.w / 14) }).map((_, k) => (
                <div
                  key={`${j}-${k}`}
                  style={{
                    position: "absolute",
                    left: 4 + k * 13,
                    top: 8 + j * 28,
                    width: 4,
                    height: 5,
                    backgroundColor: (i + j + k) % 5 === 0 ? `${COLORS.green}20` : `${COLORS.green}06`,
                    borderRadius: 1,
                  }}
                />
              ))
            )}
          </div>
        ))}
        {/* Stars */}
        {[
          { x: 30, y: 20 }, { x: 180, y: 50 }, { x: 80, y: 70 }, { x: 250, y: 25 }, { x: 350, y: 55 }, { x: 130, y: 40 },
        ].map((star, i) => (
          <div key={i} style={{ position: "absolute", left: star.x, top: star.y, width: 2, height: 2, borderRadius: "50%", backgroundColor: COLORS.green, opacity: (i % 2 === 0 ? twinkle1 : twinkle2) * 0.5 }} />
        ))}
      </div>
      {/* Window frame divider */}
      <div style={{ position: "absolute", right: 258, top: 40, width: 2, height: 480, backgroundColor: `${COLORS.green}12` }} />
      <div style={{ position: "absolute", right: 60, top: 278, width: 400, height: 2, backgroundColor: `${COLORS.green}12` }} />
      {/* Room elements - bookshelf outline */}
      <div style={{ position: "absolute", left: 40, top: 100, width: 120, height: 400, border: `1px solid ${COLORS.green}10`, borderRadius: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 90 * i + 80, height: 1, backgroundColor: `${COLORS.green}10` }} />
        ))}
      </div>
      {/* Desk lamp glow */}
      <div style={{ position: "absolute", left: 200, bottom: 200, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.green}06 0%, transparent 70%)` }} />
      {/* Floor line */}
      <div style={{ position: "absolute", bottom: 100, left: 0, right: 0, height: 1, backgroundColor: `${COLORS.green}10` }} />
    </AbsoluteFill>
  );
};

const BusyCoffeeShop: React.FC<{ frame: number }> = ({ frame }) => {
  const steamY = Math.sin(frame * 0.1) * 5;
  const lightFlicker = 0.6 + Math.sin(frame * 0.08) * 0.2;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #060610 0%, ${COLORS.dark} 20%, #0a1a0f 50%, #0f2a15 100%)` }} />
      {/* Exposed brick wall suggestion */}
      {Array.from({ length: 12 }).map((_, row) =>
        Array.from({ length: 20 }).map((_, col) => (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: col * 100 + (row % 2) * 50,
              top: row * 35,
              width: 90,
              height: 28,
              border: `1px solid ${COLORS.green}04`,
              borderRadius: 1,
            }}
          />
        ))
      )}
      {/* Large chalkboard menu */}
      <div style={{ position: "absolute", right: 80, top: 50, width: 300, height: 200, border: `2px solid ${COLORS.green}15`, borderRadius: 4, background: `rgba(0,0,0,0.3)` }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ position: "absolute", left: 20, top: 25 + i * 35, width: 100 + (i * 37 % 80), height: 3, backgroundColor: COLORS.green, opacity: 0.1, borderRadius: 2 }} />
        ))}
      </div>
      {/* Hanging pendant lights */}
      {[180, 480, 780, 1080].map((x, i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: x, top: 0, width: 1, height: 60 + i * 15, backgroundColor: `${COLORS.green}15` }} />
          <div style={{ position: "absolute", left: x - 15, top: 60 + i * 15, width: 30, height: 25, borderRadius: "0 0 50% 50%", border: `1.5px solid ${COLORS.green}20`, borderTop: "none" }} />
          <div style={{ position: "absolute", left: x - 30, top: 85 + i * 15, width: 60, height: 60, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.green}${i === 1 ? "08" : "05"} 0%, transparent 70%)`, opacity: lightFlicker }} />
        </React.Fragment>
      ))}
      {/* Coffee bar counter */}
      <div style={{ position: "absolute", bottom: 130, left: 0, right: 0, height: 3, backgroundColor: `${COLORS.green}15` }} />
      <div style={{ position: "absolute", bottom: 85, left: 0, right: 0, height: 1, backgroundColor: `${COLORS.green}08` }} />
      {/* Coffee cup */}
      <div style={{ position: "absolute", right: 250, bottom: 140 }}>
        <div style={{ width: 40, height: 35, borderRadius: "0 0 8px 8px", border: `1.5px solid ${COLORS.green}25` }} />
        <div style={{ position: "absolute", top: 4, right: -14, width: 14, height: 20, border: `1.5px solid ${COLORS.green}25`, borderLeft: "none", borderRadius: "0 8px 8px 0" }} />
        {/* Steam */}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", top: -18 - i * 8, left: 10 + i * 8, width: 2, height: 12, backgroundColor: `${COLORS.green}20`, borderRadius: 2, transform: `translateY(${steamY + i * 2}px)`, opacity: 0.3 - i * 0.08 }} />
        ))}
      </div>
      {/* Laptop outline on table */}
      <div style={{ position: "absolute", left: 300, bottom: 145 }}>
        <div style={{ width: 160, height: 100, borderRadius: "4px 4px 0 0", border: `1.5px solid ${COLORS.green}15`, transform: "perspective(200px) rotateX(5deg)" }} />
        <div style={{ width: 180, height: 8, borderRadius: "0 0 4px 4px", border: `1.5px solid ${COLORS.green}12`, borderTop: "none" }} />
      </div>
      {/* Other patron silhouettes in bg */}
      {[
        { x: 80, y: 250 },
        { x: 800, y: 280 },
      ].map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x, top: p.y }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${COLORS.green}08` }} />
          <div style={{ width: 40, height: 50, borderRadius: "8px 8px 0 0", border: `1px solid ${COLORS.green}06`, marginTop: 4, marginLeft: -5 }} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

const ModernCoworking: React.FC<{ frame: number }> = ({ frame }) => {
  const scanLine = (frame * 2) % 1080;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #060610 0%, ${COLORS.dark} 25%, #0a0f1a 60%, #0f1a2e 100%)` }} />
      {/* Grid pattern - modern office */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * 110, height: 1, backgroundColor: `${COLORS.green}05` }} />
      ))}
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: i * 110, width: 1, backgroundColor: `${COLORS.green}05` }} />
      ))}
      {/* Scan line effect */}
      <div style={{ position: "absolute", left: 0, right: 0, top: scanLine, height: 2, background: `linear-gradient(90deg, transparent, ${COLORS.green}08, transparent)`, opacity: 0.5 }} />
      {/* Large monitor */}
      <div style={{ position: "absolute", right: 80, top: 140, width: 280, height: 180, borderRadius: 8, border: `2px solid ${COLORS.green}20`, overflow: "hidden" }}>
        {/* Code on screen */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} style={{ position: "absolute", left: 12 + (i % 3) * 8, top: 14 + i * 20, width: 50 + ((i * 31) % 120), height: 3, backgroundColor: COLORS.green, borderRadius: 2, opacity: 0.12 + (i % 3) * 0.06 }} />
        ))}
        {/* Terminal cursor blink */}
        <div style={{ position: "absolute", left: 12, top: 14 + 8 * 20, width: 8, height: 14, backgroundColor: COLORS.green, opacity: Math.sin(frame * 0.2) > 0 ? 0.4 : 0 }} />
      </div>
      {/* Monitor stand */}
      <div style={{ position: "absolute", right: 208, top: 320, width: 4, height: 50, backgroundColor: `${COLORS.green}15` }} />
      <div style={{ position: "absolute", right: 180, top: 370, width: 60, height: 3, backgroundColor: `${COLORS.green}12`, borderRadius: 2 }} />
      {/* Second smaller monitor */}
      <div style={{ position: "absolute", right: 400, top: 180, width: 180, height: 120, borderRadius: 6, border: `1.5px solid ${COLORS.green}12`, overflow: "hidden" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ position: "absolute", left: 10 + (i % 2) * 6, top: 12 + i * 24, width: 40 + ((i * 23) % 60), height: 3, backgroundColor: COLORS.green, borderRadius: 2, opacity: 0.08 + (i % 2) * 0.05 }} />
        ))}
      </div>
      {/* Desk surface */}
      <div style={{ position: "absolute", bottom: 240, left: 0, right: 0, height: 2, backgroundColor: `${COLORS.green}12` }} />
      {/* Whiteboard */}
      <div style={{ position: "absolute", left: 60, top: 80, width: 240, height: 160, border: `1.5px solid ${COLORS.green}10`, borderRadius: 4 }}>
        {/* Sticky notes */}
        {[
          { x: 15, y: 15, w: 45, h: 40 },
          { x: 70, y: 20, w: 45, h: 40 },
          { x: 130, y: 12, w: 45, h: 40 },
          { x: 40, y: 70, w: 45, h: 40 },
          { x: 100, y: 75, w: 45, h: 40 },
          { x: 170, y: 65, w: 45, h: 40 },
        ].map((note, i) => (
          <div key={i} style={{ position: "absolute", left: note.x, top: note.y, width: note.w, height: note.h, border: `1px solid ${COLORS.green}${i % 2 === 0 ? "10" : "08"}`, borderRadius: 2 }} />
        ))}
      </div>
      {/* Plant */}
      <div style={{ position: "absolute", left: 350, bottom: 250 }}>
        <div style={{ width: 25, height: 30, borderRadius: "0 0 5px 5px", border: `1.5px solid ${COLORS.green}15` }} />
        <path />
        {[
          "M 12 0 Q 5 -15 -5 -25",
          "M 12 0 Q 15 -20 12 -32",
          "M 12 0 Q 22 -18 30 -28",
        ].map((d, i) => (
          <svg key={i} style={{ position: "absolute", bottom: 30, left: 0 }} width="40" height="40" viewBox="0 0 40 40">
            <path d={d} fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          </svg>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const HomeStudio: React.FC<{ frame: number }> = ({ frame }) => {
  const rgbShift = frame * 3;
  const neonPulse = 0.7 + Math.sin(frame * 0.08) * 0.3;
  const neonPulse2 = 0.7 + Math.sin(frame * 0.1 + 1) * 0.3;

  // RGB color cycling for LED strip
  const hue1 = rgbShift % 360;
  const hue2 = (rgbShift + 120) % 360;
  const hue3 = (rgbShift + 240) % 360;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #0a0a0f 0%, ${COLORS.dark} 30%, #1a0a2e 70%, #0f0f23 100%)` }} />
      {/* Top LED strip with RGB effect */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, hsl(${hue1},80%,50%), hsl(${hue2},80%,50%), hsl(${hue3},80%,50%))`, opacity: neonPulse * 0.35, boxShadow: `0 0 30px hsl(${hue1},80%,50%)20` }} />
      {/* Bottom LED strip */}
      <div style={{ position: "absolute", bottom: 100, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${COLORS.emerald}, ${COLORS.green}, ${COLORS.teal})`, opacity: neonPulse2 * 0.3, boxShadow: `0 0 25px ${COLORS.green}15` }} />
      {/* Left wall LED strip */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: `linear-gradient(180deg, hsl(${hue2},80%,50%), ${COLORS.green}, hsl(${hue3},80%,50%))`, opacity: 0.15 }} />
      {/* Main monitor - ultrawide */}
      <div style={{ position: "absolute", left: 250, top: 180, width: 340, height: 160, borderRadius: 8, border: `2px solid ${COLORS.green}20`, overflow: "hidden" }}>
        {/* Code/IDE content */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ position: "absolute", left: 12 + (i % 4) * 6, top: 12 + i * 20, width: 45 + ((i * 29) % 140), height: 3, backgroundColor: i % 3 === 0 ? COLORS.green : i % 3 === 1 ? COLORS.emerald : COLORS.teal, borderRadius: 2, opacity: 0.15 + (i % 2) * 0.08 }} />
        ))}
      </div>
      {/* Monitor stand */}
      <div style={{ position: "absolute", left: 410, top: 340, width: 4, height: 45, backgroundColor: `${COLORS.green}12` }} />
      {/* Side monitor left */}
      <div style={{ position: "absolute", left: 60, top: 200, width: 160, height: 110, borderRadius: 6, border: `1.5px solid ${COLORS.green}12`, transform: "perspective(400px) rotateY(15deg)" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: 8, top: 12 + i * 28, width: 60 + (i * 20), height: 3, backgroundColor: COLORS.green, opacity: 0.1, borderRadius: 2 }} />
        ))}
      </div>
      {/* Side monitor right */}
      <div style={{ position: "absolute", right: 80, top: 200, width: 160, height: 110, borderRadius: 6, border: `1.5px solid ${COLORS.green}12`, transform: "perspective(400px) rotateY(-15deg)" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: 8, top: 12 + i * 28, width: 40 + (i * 25), height: 3, backgroundColor: COLORS.emerald, opacity: 0.1, borderRadius: 2 }} />
        ))}
      </div>
      {/* Desk */}
      <div style={{ position: "absolute", bottom: 180, left: 20, right: 20, height: 2, backgroundColor: `${COLORS.green}12` }} />
      {/* Keyboard outline */}
      <div style={{ position: "absolute", left: 340, bottom: 192, width: 160, height: 50, borderRadius: 6, border: `1px solid ${COLORS.green}10` }}>
        {Array.from({ length: 3 }).map((_, row) =>
          Array.from({ length: 10 }).map((_, col) => (
            <div key={`${row}-${col}`} style={{ position: "absolute", left: 8 + col * 15, top: 8 + row * 14, width: 10, height: 10, borderRadius: 2, border: `1px solid ${COLORS.green}08` }} />
          ))
        )}
      </div>
      {/* Mic on boom arm */}
      <div style={{ position: "absolute", right: 200, top: 140 }}>
        <div style={{ width: 30, height: 50, borderRadius: 15, border: `1.5px solid ${COLORS.green}20` }} />
        <div style={{ position: "absolute", top: -30, left: 14, width: 2, height: 30, backgroundColor: `${COLORS.green}15` }} />
      </div>
      {/* Headphone stand */}
      <div style={{ position: "absolute", left: 120, bottom: 190 }}>
        <div style={{ width: 3, height: 60, backgroundColor: `${COLORS.green}12` }} />
        <div style={{ width: 30, height: 3, backgroundColor: `${COLORS.green}12`, marginLeft: -14, marginTop: 0 }} />
      </div>
    </AbsoluteFill>
  );
};

const RooftopBar: React.FC<{ frame: number }> = ({ frame }) => {
  const glowPulse = 0.8 + Math.sin(frame * 0.05) * 0.2;
  const parallax = Math.sin(frame * 0.015) * 4;

  return (
    <AbsoluteFill>
      {/* Sunset sky gradient */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #0a0a18 0%, #0f1428 20%, #12202e 35%, ${COLORS.dark} 50%, #0a1a0f 65%, #0f2a15 75%, #0a1628 90%, ${COLORS.dark} 100%)` }} />
      {/* Sun/horizon glow */}
      <div style={{ position: "absolute", left: "50%", top: "38%", width: 900, height: 250, borderRadius: "50%", background: `radial-gradient(ellipse, ${COLORS.green}06 0%, ${COLORS.emerald}03 40%, transparent 70%)`, transform: "translateX(-50%)", opacity: glowPulse }} />
      {/* Thin horizon line */}
      <div style={{ position: "absolute", top: "45%", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.green}15, transparent)` }} />
      {/* City skyline - depth layers */}
      {/* Far buildings */}
      {[
        { x: 0, w: 60, h: 220 },
        { x: 55, w: 45, h: 180 },
        { x: 95, w: 80, h: 300 },
        { x: 170, w: 55, h: 240 },
        { x: 220, w: 70, h: 280 },
        { x: 285, w: 50, h: 200 },
        { x: 330, w: 90, h: 340 },
        { x: 415, w: 60, h: 260 },
        { x: 470, w: 75, h: 310 },
        { x: 540, w: 55, h: 230 },
        { x: 590, w: 85, h: 350 },
        { x: 670, w: 60, h: 270 },
        { x: 725, w: 70, h: 300 },
        { x: 790, w: 50, h: 240 },
        { x: 835, w: 90, h: 370 },
        { x: 920, w: 55, h: 250 },
        { x: 970, w: 80, h: 320 },
        { x: 1045, w: 60, h: 280 },
        { x: 1100, w: 70, h: 340 },
        { x: 1165, w: 45, h: 220 },
        { x: 1205, w: 85, h: 360 },
        { x: 1285, w: 60, h: 260 },
        { x: 1340, w: 75, h: 310 },
        { x: 1410, w: 55, h: 240 },
        { x: 1460, w: 90, h: 380 },
        { x: 1545, w: 60, h: 270 },
        { x: 1600, w: 70, h: 300 },
        { x: 1665, w: 55, h: 250 },
        { x: 1715, w: 85, h: 340 },
        { x: 1795, w: 60, h: 280 },
        { x: 1850, w: 70, h: 320 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x + parallax * (i % 2 === 0 ? 0.3 : 0.5),
            bottom: 0,
            width: b.w,
            height: b.h,
            border: `1px solid ${COLORS.green}06`,
            borderBottom: "none",
            borderRadius: "2px 2px 0 0",
          }}
        >
          {Array.from({ length: Math.floor(b.h / 35) }).map((_, j) =>
            Array.from({ length: Math.floor(b.w / 16) }).map((_, k) => (
              <div
                key={`${j}-${k}`}
                style={{
                  position: "absolute",
                  left: 4 + k * 14,
                  top: 8 + j * 30,
                  width: 4,
                  height: 6,
                  backgroundColor: (i + j + k) % 5 === 0 ? `${COLORS.green}15` : `${COLORS.green}04`,
                  borderRadius: 1,
                }}
              />
            ))
          )}
        </div>
      ))}
      {/* Rooftop railing */}
      <div style={{ position: "absolute", bottom: 130, left: 0, right: 0, height: 2, backgroundColor: `${COLORS.green}18` }} />
      {/* Railing posts */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", bottom: 100, left: i * 100, width: 2, height: 32, backgroundColor: `${COLORS.green}12` }} />
      ))}
      {/* Bar counter/table */}
      <div style={{ position: "absolute", bottom: 90, right: 100, width: 250, height: 3, backgroundColor: `${COLORS.green}12`, borderRadius: 2 }} />
      {/* Cocktail glass */}
      <div style={{ position: "absolute", right: 180, bottom: 93 }}>
        <svg width="25" height="30" viewBox="0 0 25 30">
          <path d="M 4 0 L 21 0 L 14 15 L 14 25 L 18 28 L 7 28 L 11 25 L 11 15 Z" fill="none" stroke={COLORS.green} strokeWidth="1.5" opacity="0.3" />
        </svg>
      </div>
      {/* String lights across top */}
      <path
        d="M 0 60 Q 160 90 320 60 Q 480 90 640 60 Q 800 90 960 60 Q 1120 90 1280 60 Q 1440 90 1600 60 Q 1760 90 1920 60"
        fill="none"
        stroke={`${COLORS.green}10`}
        strokeWidth="1"
        style={{ position: "absolute" }}
      />
      {/* Rendered as div approximation of string lights */}
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 60 + i * 120, top: 55 + Math.sin(i * 0.5) * 15, width: 6, height: 6, borderRadius: "50%", backgroundColor: COLORS.green, opacity: 0.08 + (i % 3) * 0.04, boxShadow: `0 0 8px ${COLORS.green}15` }} />
      ))}
    </AbsoluteFill>
  );
};

const EnvironmentBg: React.FC<{ type: string; frame: number }> = ({ type, frame }) => {
  switch (type) {
    case "apartment-night":
      return <DowntownApartment frame={frame} />;
    case "coffee-shop":
      return <BusyCoffeeShop frame={frame} />;
    case "coworking":
      return <ModernCoworking frame={frame} />;
    case "home-studio":
      return <HomeStudio frame={frame} />;
    case "rooftop-bar":
      return <RooftopBar frame={frame} />;
    default:
      return null;
  }
};

// ============================================
// PHONE CALL UI OVERLAY
// ============================================
const PhoneCallUI: React.FC<{
  contactName: string;
  direction: "outgoing" | "incoming";
  frame: number;
  fps: number;
}> = ({ contactName, direction, frame, fps }) => {
  const slideIn = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 120 } });
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
      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: COLORS.green, opacity: pulseOpacity, boxShadow: `0 0 10px ${COLORS.green}` }} />
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      <div>
        <p style={{ fontSize: 12, color: `${COLORS.green}80`, margin: 0, fontFamily: FONT, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {direction === "outgoing" ? "Calling..." : "Incoming call"}
        </p>
        <p style={{ fontSize: 20, color: COLORS.white, margin: 0, fontFamily: FONT, fontWeight: 600 }}>
          {contactName}
        </p>
      </div>
    </div>
  );
};

// ============================================
// SPEECH BUBBLE
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

  const slideUp = spring({ frame: adjustedFrame, fps, config: { damping: 14, stiffness: 100 } });
  const offset = interpolate(slideUp, [0, 1], [60, 0]);
  const opacity = interpolate(slideUp, [0, 1], [0, 1]);

  const charsPerFrame = 1.8;
  const visibleChars = Math.min(quote.length, Math.floor(adjustedFrame * charsPerFrame));
  const displayedText = quote.slice(0, visibleChars);

  return (
    <div style={{ position: "absolute", bottom: 60, left: "50%", transform: `translateX(-50%) translateY(${offset}px)`, opacity, maxWidth: 900, width: "80%" }}>
      <div style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(20px)", border: `1.5px solid ${accentColor}30`, borderRadius: 24, padding: "28px 36px", boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${accentColor}08` }}>
        <span style={{ fontSize: 48, color: accentColor, fontFamily: "Georgia, serif", lineHeight: 0.5, display: "block", marginBottom: 8, opacity: 0.6 }}>
          &ldquo;
        </span>
        <p style={{ fontSize: 30, color: COLORS.white, fontFamily: FONT, fontWeight: 500, lineHeight: 1.5, margin: 0, letterSpacing: "-0.01em" }}>
          {displayedText}
          {visibleChars < quote.length && (
            <span style={{ display: "inline-block", width: 3, height: 28, backgroundColor: COLORS.green, marginLeft: 2, opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0, verticalAlign: "text-bottom" }} />
          )}
        </p>
      </div>
    </div>
  );
};

// ============================================
// LOCATION TAG
// ============================================
const LocationTag: React.FC<{ text: string; frame: number; fps: number }> = ({ text, frame, fps }) => {
  const fadeIn = spring({ frame: frame - 15, fps, config: { damping: 16, stiffness: 100 } });
  const opacity = interpolate(fadeIn, [0, 1], [0, 0.9]);

  return (
    <div style={{ position: "absolute", top: 110, left: "50%", transform: "translateX(-50%)", opacity, display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", padding: "8px 20px", borderRadius: 30, border: `1px solid ${COLORS.green}15` }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <p style={{ fontSize: 14, color: "#9ca3af", margin: 0, fontFamily: FONT, fontWeight: 400, letterSpacing: "0.03em" }}>
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

  const avatarSpring = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 120 } });
  const avatarScale = interpolate(avatarSpring, [0, 1], [0.6, 1]);
  const avatarOpacity = interpolate(avatarSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <EnvironmentBg type={scene.envType} frame={frame} />
      <PhoneCallUI contactName={scene.contactName} direction={scene.callDirection} frame={frame} fps={fps} />
      <LocationTag text={scene.callingFrom} frame={frame} fps={fps} />

      {/* Character avatar */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(-50%, -65%) scale(${avatarScale})`, opacity: avatarOpacity }}>
        <RealisticAvatar character={scene.character} size={300} animate frame={frame} fps={fps} />
        {/* Name label */}
        <p style={{ textAlign: "center", fontSize: 24, color: COLORS.green, fontFamily: FONT, fontWeight: 600, margin: "4px 0 0 0", textShadow: `0 0 20px ${COLORS.green}40`, letterSpacing: "0.05em" }}>
          {scene.character.name}
        </p>
      </div>

      <SpeechBubble quote={scene.quote} accentColor={scene.quoteAccent} frame={frame} fps={fps} delay={30} />
    </AbsoluteFill>
  );
};

// ============================================
// INTRO SCENE
// ============================================
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ringScale1 = interpolate(frame, [0, 60], [0.5, 2.5], { extrapolateRight: "clamp", easing: Easing.out(Easing.ease) });
  const ringOpacity1 = interpolate(frame, [0, 60], [0.6, 0], { extrapolateRight: "clamp" });
  const ringScale2 = interpolate(frame, [15, 75], [0.5, 2.5], { extrapolateRight: "clamp", easing: Easing.out(Easing.ease) });
  const ringOpacity2 = interpolate(frame, [15, 75], [0.6, 0], { extrapolateRight: "clamp" });
  const ringScale3 = interpolate(frame, [30, 90], [0.5, 2.5], { extrapolateRight: "clamp", easing: Easing.out(Easing.ease) });
  const ringOpacity3 = interpolate(frame, [30, 90], [0.6, 0], { extrapolateRight: "clamp" });

  const phoneSpring = spring({ frame, fps, config: { damping: 10, stiffness: 150 } });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.3, 1]);

  const textSpring = spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 120 } });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [30, 0]);

  const subtitleSpring = spring({ frame: frame - 45, fps, config: { damping: 12, stiffness: 120 } });
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);

  const vibrate = frame < 60 ? Math.sin(frame * 2) * 3 : 0;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkAlt} 50%, #16213e 100%)`, justifyContent: "center", alignItems: "center" }}>
      {/* Ripple rings */}
      {[
        { scale: ringScale1, opacity: ringOpacity1, color: COLORS.green },
        { scale: ringScale2, opacity: ringOpacity2, color: COLORS.emerald },
        { scale: ringScale3, opacity: ringOpacity3, color: COLORS.teal },
      ].map((ring, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 200,
            height: 200,
            borderRadius: "50%",
            border: `2px solid ${ring.color}`,
            transform: `translate(-50%, -60%) scale(${ring.scale})`,
            opacity: ring.opacity,
          }}
        />
      ))}

      {/* Phone icon */}
      <div style={{ transform: `scale(${phoneScale}) translateX(${vibrate}px)`, marginBottom: 40 }}>
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 72, color: COLORS.white, fontFamily: FONT, fontWeight: 300, margin: 0, opacity: textOpacity, transform: `translateY(${textY}px)`, letterSpacing: "-0.02em" }}>
          Have you heard about
        </h1>
        <h1 style={{ fontSize: 110, color: COLORS.green, fontFamily: FONT, fontWeight: 700, margin: "10px 0 0 0", opacity: textOpacity, transform: `translateY(${textY}px)`, letterSpacing: "-0.03em", textShadow: `0 0 60px ${COLORS.green}30` }}>
          App Market
        </h1>
        <p style={{ fontSize: 28, color: "#6b7280", fontFamily: FONT, fontWeight: 400, margin: "20px 0 0 0", opacity: subtitleOpacity }}>
          The premier software marketplace.
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
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkAlt} 100%)`, justifyContent: "center", alignItems: "center" }}>
      {(() => {
        const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
        const opacity = interpolate(titleSpring, [0, 1], [0, 1]);
        const y = interpolate(titleSpring, [0, 1], [30, 0]);
        return (
          <h2 style={{ position: "absolute", top: 60, fontSize: 52, color: COLORS.white, fontFamily: FONT, fontWeight: 300, margin: 0, opacity, transform: `translateY(${y}px)`, letterSpacing: "-0.01em" }}>
            Everyone&apos;s talking about it.
          </h2>
        );
      })()}

      {/* Character grid */}
      <div style={{ display: "flex", gap: 40, marginTop: 40 }}>
        {SCENES.map((scene, i) => {
          const delay = 10 + i * 8;
          const charSpring = spring({ frame: frame - delay, fps, config: { damping: 10, stiffness: 150 } });
          const scale = interpolate(charSpring, [0, 1], [0.4, 1]);
          const charOpacity = interpolate(charSpring, [0, 1], [0, 1]);

          return (
            <div key={i} style={{ textAlign: "center", opacity: charOpacity, transform: `scale(${scale})` }}>
              <div
                style={{
                  width: 200,
                  height: 260,
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
                <div style={{ transform: "scale(0.5)", marginTop: 20 }}>
                  <RealisticAvatar character={scene.character} size={300} />
                </div>
              </div>
              <p style={{ fontSize: 20, color: COLORS.green, fontFamily: FONT, fontWeight: 600, margin: "14px 0 0 0", letterSpacing: "0.03em" }}>
                {scene.character.name}
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", fontFamily: FONT, fontWeight: 400, margin: "4px 0 0 0" }}>
                {scene.callingFrom.split(",")[0]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Connection line */}
      {(() => {
        const lineWidth = interpolate(frame, [50, 90], [0, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{ position: "absolute", bottom: 100, left: "50%", width: lineWidth, height: 2, background: `linear-gradient(90deg, transparent, ${COLORS.green}60, transparent)`, transform: "translateX(-50%)", borderRadius: 2, boxShadow: `0 0 20px ${COLORS.green}20` }} />
        );
      })()}
    </AbsoluteFill>
  );
};

// ============================================
// CTA FINAL SCENE
// ============================================
const CTAFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const taglineSpring = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 100 } });
  const taglineOpacity = interpolate(taglineSpring, [0, 1], [0, 1]);
  const taglineY = interpolate(taglineSpring, [0, 1], [20, 0]);

  const buttonSpring = spring({ frame: frame - 30, fps, config: { damping: 12, stiffness: 120 } });
  const buttonScale = interpolate(buttonSpring, [0, 1], [0.7, 1]);
  const buttonOpacity = interpolate(buttonSpring, [0, 1], [0, 1]);

  const subtextSpring = spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 100 } });
  const subtextOpacity = interpolate(subtextSpring, [0, 1], [0, 1]);

  const gradAngle = interpolate(frame, [0, 300], [135, 225], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(${gradAngle}deg, ${COLORS.dark} 0%, #0a1628 50%, ${COLORS.dark} 100%)`, justifyContent: "center", alignItems: "center" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.green}08 0%, transparent 70%)`, transform: "translate(-50%, -50%)" }} />

      {/* Prominent realistic desk with computer */}
      {(() => {
        const deskSpring = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 100 } });
        const deskOpacity = interpolate(deskSpring, [0, 1], [0, 1]);
        const deskY = interpolate(deskSpring, [0, 1], [40, 0]);
        const screenGlow = 0.6 + Math.sin(frame * 0.08) * 0.15;
        const cursorBlink = Math.sin(frame * 0.25) > 0 ? 0.8 : 0;

        return (
          <div style={{ position: "absolute", bottom: 0, left: "50%", transform: `translateX(-50%) translateY(${deskY}px)`, opacity: deskOpacity, width: 1200, height: 520 }}>
            {/* Monitor glow on wall */}
            <div style={{ position: "absolute", top: -60, left: "50%", width: 500, height: 200, borderRadius: "50%", background: `radial-gradient(ellipse, ${COLORS.green}06 0%, transparent 70%)`, transform: "translateX(-50%)", opacity: screenGlow }} />

            {/* Monitor */}
            <div style={{ position: "absolute", left: "50%", top: 20, transform: "translateX(-50%)", width: 480, height: 280 }}>
              {/* Monitor bezel */}
              <div style={{
                width: 480, height: 280, borderRadius: 16,
                background: "linear-gradient(145deg, #1a1a2e, #12121f)",
                border: `2px solid ${COLORS.green}18`,
                boxShadow: `0 0 60px ${COLORS.green}08, inset 0 0 40px rgba(0,0,0,0.5)`,
                overflow: "hidden", position: "relative",
              }}>
                {/* Screen area */}
                <div style={{
                  position: "absolute", top: 10, left: 10, right: 10, bottom: 10,
                  borderRadius: 8,
                  background: `linear-gradient(180deg, #0a0f1a, #0d1520)`,
                  border: `1px solid ${COLORS.green}10`,
                  overflow: "hidden",
                }}>
                  {/* IDE / App Market dashboard on screen */}
                  {/* Top bar */}
                  <div style={{ height: 24, background: `rgba(0,0,0,0.5)`, display: "flex", alignItems: "center", padding: "0 10px", gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#ff5f57", opacity: 0.7 }} />
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#febc2e", opacity: 0.7 }} />
                    <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#28c840", opacity: 0.7 }} />
                    <div style={{ flex: 1 }} />
                    <div style={{ width: 120, height: 12, borderRadius: 6, background: `rgba(255,255,255,0.06)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: `${COLORS.green}20` }} />
                    </div>
                    <div style={{ flex: 1 }} />
                  </div>
                  {/* Sidebar */}
                  <div style={{ position: "absolute", top: 24, left: 0, width: 50, bottom: 0, borderRight: `1px solid ${COLORS.green}08` }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${COLORS.green}${i === 0 ? "20" : "08"}`, margin: "10px auto 0", background: i === 0 ? `${COLORS.green}10` : "transparent" }} />
                    ))}
                  </div>
                  {/* Main content area - dashboard cards */}
                  <div style={{ position: "absolute", top: 36, left: 58, right: 8, bottom: 8 }}>
                    {/* Header text lines */}
                    <div style={{ width: 100, height: 5, borderRadius: 3, backgroundColor: COLORS.green, opacity: 0.25, marginBottom: 6 }} />
                    <div style={{ width: 65, height: 3, borderRadius: 2, backgroundColor: `${COLORS.green}`, opacity: 0.12, marginBottom: 14 }} />
                    {/* Dashboard cards row */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{
                          flex: 1, height: 48, borderRadius: 6,
                          border: `1px solid ${COLORS.green}${i === 0 ? "15" : "08"}`,
                          background: `rgba(0,0,0,0.3)`, padding: 6,
                        }}>
                          <div style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: `${COLORS.green}20`, marginBottom: 4 }} />
                          <div style={{ width: 42, height: 5, borderRadius: 2, backgroundColor: COLORS.green, opacity: 0.2 + i * 0.05 }} />
                        </div>
                      ))}
                    </div>
                    {/* App listing rows */}
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                        borderBottom: `1px solid ${COLORS.green}06`,
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${COLORS.green}12`, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ width: 70 + i * 12, height: 3, borderRadius: 2, backgroundColor: `${COLORS.green}15`, marginBottom: 3 }} />
                          <div style={{ width: 40 + i * 8, height: 2, borderRadius: 2, backgroundColor: `${COLORS.green}08` }} />
                        </div>
                        <div style={{ width: 35, height: 14, borderRadius: 4, border: `1px solid ${COLORS.green}15`, flexShrink: 0 }} />
                      </div>
                    ))}
                    {/* Cursor blink */}
                    <div style={{ position: "absolute", bottom: 12, left: 8, width: 6, height: 14, backgroundColor: COLORS.green, opacity: cursorBlink, borderRadius: 1 }} />
                  </div>
                  {/* Screen glow overlay */}
                  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${COLORS.green}03 0%, transparent 70%)`, pointerEvents: "none" }} />
                </div>
              </div>
              {/* Monitor chin / logo */}
              <div style={{ width: 30, height: 6, borderRadius: 3, backgroundColor: `${COLORS.green}15`, margin: "-14px auto 0" }} />
            </div>
            {/* Monitor stand neck */}
            <div style={{ position: "absolute", left: "50%", top: 300, transform: "translateX(-50%)", width: 14, height: 50, background: `linear-gradient(180deg, #1a1a2e, #22222e)`, borderRadius: 4 }} />
            {/* Monitor stand base */}
            <div style={{ position: "absolute", left: "50%", top: 346, transform: "translateX(-50%)", width: 120, height: 8, background: `linear-gradient(180deg, #22222e, #1a1a2e)`, borderRadius: "50%", border: `1px solid ${COLORS.green}08` }} />

            {/* Desk surface */}
            <div style={{
              position: "absolute", left: 50, right: 50, top: 360, height: 20,
              background: "linear-gradient(180deg, #2a1f14 0%, #1e160e 40%, #18120a 100%)",
              borderRadius: "4px 4px 0 0",
              boxShadow: `0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
              border: `1px solid rgba(255,255,255,0.03)`,
              borderBottom: "none",
            }}>
              {/* Wood grain texture lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ position: "absolute", top: 4 + i * 3, left: 20, right: 20, height: 1, backgroundColor: `rgba(255,255,255,0.015)`, borderRadius: 1 }} />
              ))}
            </div>
            {/* Desk front face */}
            <div style={{
              position: "absolute", left: 50, right: 50, top: 380, height: 60,
              background: "linear-gradient(180deg, #1e160e 0%, #15100a 100%)",
              border: `1px solid rgba(255,255,255,0.02)`,
              borderTop: "none",
            }}>
              {/* Drawer handle */}
              <div style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", width: 80, height: 4, borderRadius: 3, background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)` }} />
            </div>
            {/* Desk legs */}
            <div style={{ position: "absolute", left: 80, top: 440, width: 8, height: 80, background: "linear-gradient(180deg, #15100a, #0f0a06)", borderRadius: 2 }} />
            <div style={{ position: "absolute", right: 80, top: 440, width: 8, height: 80, background: "linear-gradient(180deg, #15100a, #0f0a06)", borderRadius: 2 }} />

            {/* Keyboard */}
            <div style={{ position: "absolute", left: "50%", top: 330, transform: "translateX(-50%)", width: 200, height: 28 }}>
              <div style={{
                width: 200, height: 28, borderRadius: 5,
                background: "linear-gradient(180deg, #1a1a22, #141418)",
                border: `1px solid rgba(255,255,255,0.04)`,
                padding: 3,
              }}>
                {/* Key rows */}
                {[0, 1, 2].map((row) => (
                  <div key={row} style={{ display: "flex", gap: 2, marginBottom: 1, justifyContent: "center" }}>
                    {Array.from({ length: row === 2 ? 8 : 12 }).map((_, col) => (
                      <div key={col} style={{
                        width: row === 2 && col === 3 ? 28 : 10, height: 6,
                        borderRadius: 1.5, backgroundColor: `rgba(255,255,255,0.04)`,
                        border: `0.5px solid rgba(255,255,255,0.03)`,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Mouse */}
            <div style={{ position: "absolute", left: "50%", top: 332, marginLeft: 140 }}>
              <div style={{ width: 22, height: 32, borderRadius: "10px 10px 12px 12px", border: `1px solid rgba(255,255,255,0.04)`, background: "linear-gradient(180deg, #1a1a22, #141418)" }}>
                <div style={{ width: 1, height: 8, backgroundColor: `rgba(255,255,255,0.06)`, margin: "4px auto 0", borderRadius: 1 }} />
              </div>
            </div>

            {/* Coffee mug */}
            <div style={{ position: "absolute", left: "50%", top: 320, marginLeft: -220 }}>
              <div style={{ width: 26, height: 22, borderRadius: "0 0 5px 5px", border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(0,0,0,0.3)" }}>
                <div style={{ position: "absolute", top: 3, right: -9, width: 9, height: 14, border: `1px solid rgba(255,255,255,0.05)`, borderLeft: "none", borderRadius: "0 6px 6px 0" }} />
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ textAlign: "center", position: "relative", zIndex: 1, marginTop: -200 }}>
        <h1 style={{ fontSize: 130, fontWeight: 700, color: COLORS.green, margin: 0, fontFamily: FONT, letterSpacing: "-0.03em", opacity: logoOpacity, transform: `scale(${logoScale})`, textShadow: `0 0 80px ${COLORS.green}30` }}>
          App Market
        </h1>

        <p style={{ fontSize: 36, color: COLORS.white, fontFamily: FONT, fontWeight: 400, margin: "20px 0 0 0", opacity: taglineOpacity, transform: `translateY(${taglineY}px)` }}>
          Your code has value. Now it has a market.
        </p>

        <div style={{ display: "inline-block", padding: "22px 64px", background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`, borderRadius: 100, marginTop: 50, opacity: buttonOpacity, transform: `scale(${buttonScale})`, boxShadow: `0 20px 60px ${COLORS.green}40` }}>
          <p style={{ fontSize: 36, color: COLORS.white, fontFamily: FONT, fontWeight: 700, margin: 0, letterSpacing: "0.02em" }}>
            appmrkt.xyz
          </p>
        </div>

        <p style={{ fontSize: 20, color: "#4b5563", fontFamily: FONT, fontWeight: 400, margin: "30px 0 0 0", opacity: subtextOpacity, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Powered by Solana
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// TRANSITION WIPE
// ============================================
const TransitionWipe: React.FC<{ color?: string }> = ({ color = COLORS.green }) => {
  const frame = useCurrentFrame();

  const wipeProgress = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) });
  const wipeOut = interpolate(frame, [8, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: `${wipeOut * 100}%`, width: `${wipeProgress * 100}%`, height: "100%", backgroundColor: color }} />
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION - ~54 seconds at 30fps
// ============================================
export const RealPeoplePromo: React.FC = () => {
  const INTRO = 120; // 4s
  const CHAR_SCENE = 240; // 8s
  const ALL_TOGETHER = 150; // 5s
  const CTA = 150; // 5s
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
            <Sequence from={start + CHAR_SCENE - TRANSITION} durationInFrames={TRANSITION}>
              <TransitionWipe color={SCENES[Math.min(i + 1, SCENES.length - 1)].bgGradient[0]} />
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
