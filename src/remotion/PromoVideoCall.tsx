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
  lightGray: "#f3f4f6",
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
    bgColors: ["#1a1a2e", "#16213e", "#0f3460"],
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
    bgColors: ["#fef3c7", "#fde68a", "#f59e0b"],
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
    bgColors: ["#ede9fe", "#c4b5fd", "#8b5cf6"],
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
    bgColors: ["#0f0f23", "#1a0a2e", "#2d1b69"],
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
    bgColors: ["#fdf2f8", "#fbcfe8", "#f472b6"],
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
        {/* Body / Shirt */}
        <ellipse
          cx="100"
          cy="195"
          rx="65"
          ry="40"
          fill={character.shirtColor}
        />

        {/* Neck */}
        <rect
          x="88"
          y="130"
          width="24"
          height="30"
          rx="8"
          fill={character.skinTone}
        />

        {/* Head */}
        <ellipse
          cx="100"
          cy="100"
          rx="52"
          ry="58"
          fill={character.skinTone}
        />

        {/* Hair based on style */}
        {character.hairStyle === "curly" && (
          <>
            <ellipse cx="100" cy="62" rx="56" ry="35" fill={character.hairColor} />
            <circle cx="52" cy="75" r="16" fill={character.hairColor} />
            <circle cx="148" cy="75" r="16" fill={character.hairColor} />
            <circle cx="58" cy="58" r="14" fill={character.hairColor} />
            <circle cx="142" cy="58" r="14" fill={character.hairColor} />
            <circle cx="75" cy="48" r="12" fill={character.hairColor} />
            <circle cx="125" cy="48" r="12" fill={character.hairColor} />
          </>
        )}
        {character.hairStyle === "short" && (
          <>
            <ellipse cx="100" cy="65" rx="54" ry="32" fill={character.hairColor} />
            <rect x="48" y="60" width="104" height="20" rx="8" fill={character.hairColor} />
          </>
        )}
        {character.hairStyle === "long" && (
          <>
            <ellipse cx="100" cy="62" rx="56" ry="34" fill={character.hairColor} />
            <rect x="46" y="60" width="20" height="80" rx="10" fill={character.hairColor} />
            <rect x="134" y="60" width="20" height="80" rx="10" fill={character.hairColor} />
          </>
        )}
        {character.hairStyle === "fade" && (
          <>
            <ellipse cx="100" cy="68" rx="50" ry="26" fill={character.hairColor} />
            <rect x="52" y="58" width="96" height="16" rx="6" fill={character.hairColor} opacity="0.7" />
            <rect x="56" y="70" width="88" height="8" rx="4" fill={character.hairColor} opacity="0.4" />
          </>
        )}
        {character.hairStyle === "bob" && (
          <>
            <ellipse cx="100" cy="62" rx="58" ry="34" fill={character.hairColor} />
            <rect x="44" y="60" width="24" height="55" rx="12" fill={character.hairColor} />
            <rect x="132" y="60" width="24" height="55" rx="12" fill={character.hairColor} />
          </>
        )}

        {/* Eyes */}
        <ellipse cx="80" cy="102" rx="6" ry="7" fill="#1a1a1a" />
        <ellipse cx="120" cy="102" rx="6" ry="7" fill="#1a1a1a" />
        <circle cx="82" cy="100" r="2" fill="white" />
        <circle cx="122" cy="100" r="2" fill="white" />

        {/* Eyebrows */}
        <line x1="72" y1="90" x2="88" y2="88" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
        <line x1="112" y1="88" x2="128" y2="90" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />

        {/* Smile */}
        <path
          d="M 82 120 Q 100 138 118 120"
          stroke="#1a1a1a"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Nose */}
        <path
          d="M 100 106 Q 96 116 100 118 Q 104 116 100 106"
          fill={character.skinTone}
          stroke={character.skinTone}
          strokeWidth="1"
          filter="brightness(0.9)"
        />

        {/* Accessories */}
        {character.accessory === "glasses" && (
          <>
            <circle cx="80" cy="102" r="16" fill="none" stroke="#333" strokeWidth="2.5" />
            <circle cx="120" cy="102" r="16" fill="none" stroke="#333" strokeWidth="2.5" />
            <line x1="96" y1="102" x2="104" y2="102" stroke="#333" strokeWidth="2.5" />
            <line x1="64" y1="100" x2="52" y2="96" stroke="#333" strokeWidth="2" />
            <line x1="136" y1="100" x2="148" y2="96" stroke="#333" strokeWidth="2" />
          </>
        )}
        {character.accessory === "earrings" && (
          <>
            <circle cx="50" cy="112" r="5" fill="#fbbf24" />
            <circle cx="150" cy="112" r="5" fill="#fbbf24" />
          </>
        )}
        {character.accessory === "headphones" && (
          <>
            <path
              d="M 48 90 Q 48 50 100 50 Q 152 50 152 90"
              fill="none"
              stroke="#333"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <rect x="40" y="85" width="16" height="28" rx="6" fill="#333" />
            <rect x="144" y="85" width="16" height="28" rx="6" fill="#333" />
            <rect x="42" y="88" width="12" height="22" rx="5" fill="#555" />
            <rect x="146" y="88" width="12" height="22" rx="5" fill="#555" />
          </>
        )}
        {character.accessory === "beanie" && (
          <>
            <ellipse cx="100" cy="60" rx="58" ry="28" fill="#e11d48" />
            <rect x="42" y="55" width="116" height="18" rx="4" fill="#be123c" />
            <circle cx="100" cy="34" r="6" fill="#e11d48" />
          </>
        )}
      </svg>
    </div>
  );
};

// ============================================
// ENVIRONMENT BACKGROUNDS
// ============================================
const ApartmentNight: React.FC<{ frame: number }> = ({ frame }) => {
  const twinkle1 = 0.5 + Math.sin(frame * 0.15) * 0.5;
  const twinkle2 = 0.5 + Math.sin(frame * 0.2 + 1) * 0.5;
  const twinkle3 = 0.5 + Math.sin(frame * 0.12 + 2) * 0.5;

  return (
    <AbsoluteFill>
      {/* Dark room gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #0f0f23 0%, #1a1a2e 40%, #16213e 100%)",
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
          border: "4px solid #2a2a4a",
          borderRadius: 8,
          background: "linear-gradient(180deg, #1e3a5f 0%, #2d5a87 100%)",
          overflow: "hidden",
        }}
      >
        {/* Moon */}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "radial-gradient(circle, #fef9c3 0%, #fde68a 100%)",
            boxShadow: "0 0 40px #fef9c320",
          }}
        />
        {/* Stars */}
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
              backgroundColor: "#fef9c3",
              opacity: i % 3 === 0 ? twinkle1 : i % 3 === 1 ? twinkle2 : twinkle3,
            }}
          />
        ))}
      </div>
      {/* Warm lamp glow */}
      <div
        style={{
          position: "absolute",
          left: 100,
          bottom: 200,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, #fbbf2420 0%, transparent 70%)",
        }}
      />
      {/* Desk lamp */}
      <div
        style={{
          position: "absolute",
          left: 140,
          bottom: 300,
          width: 8,
          height: 120,
          backgroundColor: "#555",
          borderRadius: 4,
          transform: "rotate(-15deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          bottom: 380,
          width: 60,
          height: 30,
          backgroundColor: "#666",
          borderRadius: "30px 30px 0 0",
          boxShadow: "0 8px 30px #fbbf2430",
        }}
      />
      {/* Plant */}
      <div style={{ position: "absolute", right: 60, bottom: 100 }}>
        <div
          style={{
            width: 40,
            height: 60,
            backgroundColor: "#7c6f5b",
            borderRadius: "0 0 8px 8px",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -40,
            left: -10,
            width: 60,
            height: 50,
            borderRadius: "50%",
            backgroundColor: "#22c55e40",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -30,
            left: 5,
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#22c55e50",
          }}
        />
      </div>
      {/* Fairy lights string */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 80 + i * 90,
            top: 60 + Math.sin(i * 0.8) * 20,
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: ["#fbbf24", "#f472b6", "#60a5fa", "#34d399"][i % 4],
            opacity: 0.6 + Math.sin(frame * 0.1 + i) * 0.3,
            boxShadow: `0 0 10px ${["#fbbf24", "#f472b6", "#60a5fa", "#34d399"][i % 4]}60`,
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
        background: "linear-gradient(180deg, #fffbeb 0%, #fef3c7 40%, #fde68a 100%)",
      }}
    />
    {/* Big window with sunlight */}
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "60%",
        height: "70%",
        background: "linear-gradient(180deg, #fef9c340 0%, #fbbf2410 100%)",
      }}
    />
    {/* Coffee cup */}
    <div style={{ position: "absolute", right: 200, bottom: 180 }}>
      <div
        style={{
          width: 50,
          height: 45,
          backgroundColor: "#f5f5f4",
          borderRadius: "0 0 10px 10px",
          border: "2px solid #d6d3d1",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 5,
          right: -18,
          width: 18,
          height: 25,
          border: "3px solid #d6d3d1",
          borderLeft: "none",
          borderRadius: "0 10px 10px 0",
        }}
      />
      {/* Steam */}
      <div
        style={{
          position: "absolute",
          top: -25,
          left: 12,
          width: 2,
          height: 20,
          backgroundColor: "#d6d3d180",
          borderRadius: 2,
          transform: `translateY(${Math.sin(frame * 0.1) * 5}px)`,
          opacity: 0.5 + Math.sin(frame * 0.15) * 0.3,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -30,
          left: 22,
          width: 2,
          height: 20,
          backgroundColor: "#d6d3d180",
          borderRadius: 2,
          transform: `translateY(${Math.sin(frame * 0.12 + 1) * 5}px)`,
          opacity: 0.4 + Math.sin(frame * 0.13 + 1) * 0.3,
        }}
      />
    </div>
    {/* Wooden table edge */}
    <div
      style={{
        position: "absolute",
        bottom: 140,
        left: 0,
        right: 0,
        height: 12,
        backgroundColor: "#92400e",
        borderRadius: 4,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 140,
        backgroundColor: "#a16207",
        opacity: 0.3,
      }}
    />
    {/* Hanging pendant lights */}
    {[250, 550, 850].map((x, i) => (
      <React.Fragment key={i}>
        <div
          style={{
            position: "absolute",
            left: x,
            top: 0,
            width: 2,
            height: 80 + i * 20,
            backgroundColor: "#78716c",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: x - 20,
            top: 75 + i * 20,
            width: 44,
            height: 30,
            backgroundColor: "#292524",
            borderRadius: "0 0 22px 22px",
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
            background: "radial-gradient(circle, #fbbf2460 0%, transparent 70%)",
          }}
        />
      </React.Fragment>
    ))}
    {/* Chalkboard menu */}
    <div
      style={{
        position: "absolute",
        right: 60,
        top: 80,
        width: 180,
        height: 240,
        backgroundColor: "#1c1917",
        borderRadius: 8,
        border: "6px solid #78716c",
        padding: 16,
      }}
    >
      <div style={{ width: 80, height: 3, backgroundColor: "#fef9c360", borderRadius: 2, marginBottom: 12 }} />
      <div style={{ width: 120, height: 2, backgroundColor: "#fef9c330", borderRadius: 2, marginBottom: 8 }} />
      <div style={{ width: 100, height: 2, backgroundColor: "#fef9c330", borderRadius: 2, marginBottom: 8 }} />
      <div style={{ width: 110, height: 2, backgroundColor: "#fef9c330", borderRadius: 2 }} />
    </div>
  </AbsoluteFill>
);

const CoworkingSpace: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, #f5f3ff 0%, #ede9fe 40%, #ddd6fe 100%)",
      }}
    />
    {/* Standing desk with monitors */}
    <div style={{ position: "absolute", right: 100, bottom: 200 }}>
      {/* Monitor 1 */}
      <div
        style={{
          width: 200,
          height: 130,
          backgroundColor: "#1e1b4b",
          borderRadius: 8,
          border: "3px solid #a5b4fc",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Code lines on screen */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 10 + (i % 3) * 8,
              top: 12 + i * 18,
              width: 40 + (i * 23) % 80,
              height: 4,
              backgroundColor: [COLORS.green, "#818cf8", "#f472b6", COLORS.teal, "#fbbf24", "#60a5fa"][i],
              borderRadius: 2,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      {/* Monitor stand */}
      <div
        style={{
          width: 12,
          height: 40,
          backgroundColor: "#a5b4fc",
          margin: "0 auto",
          borderRadius: 2,
        }}
      />
    </div>
    {/* Desk surface */}
    <div
      style={{
        position: "absolute",
        bottom: 150,
        right: 40,
        width: 400,
        height: 10,
        backgroundColor: "#e2e8f0",
        borderRadius: 4,
      }}
    />
    {/* Desk legs */}
    <div style={{ position: "absolute", bottom: 0, right: 60, width: 6, height: 150, backgroundColor: "#cbd5e1" }} />
    <div style={{ position: "absolute", bottom: 0, right: 420, width: 6, height: 150, backgroundColor: "#cbd5e1" }} />
    {/* Whiteboard */}
    <div
      style={{
        position: "absolute",
        left: 80,
        top: 100,
        width: 300,
        height: 200,
        backgroundColor: "#fff",
        borderRadius: 4,
        border: "3px solid #e2e8f0",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
      }}
    >
      {/* Sticky notes */}
      <div style={{ position: "absolute", left: 20, top: 20, width: 60, height: 60, backgroundColor: "#fef08a", borderRadius: 2, transform: "rotate(-3deg)" }} />
      <div style={{ position: "absolute", left: 100, top: 30, width: 60, height: 60, backgroundColor: "#bbf7d0", borderRadius: 2, transform: "rotate(2deg)" }} />
      <div style={{ position: "absolute", left: 180, top: 15, width: 60, height: 60, backgroundColor: "#bfdbfe", borderRadius: 2, transform: "rotate(-1deg)" }} />
      <div style={{ position: "absolute", left: 60, top: 110, width: 60, height: 60, backgroundColor: "#fecdd3", borderRadius: 2, transform: "rotate(4deg)" }} />
    </div>
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
          background: "linear-gradient(180deg, #0a0a1a 0%, #0f0f23 40%, #1a0a2e 100%)",
        }}
      />
      {/* LED strip top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${COLORS.green}, #8b5cf6, ${COLORS.green})`,
          opacity: neonPulse,
          boxShadow: `0 0 30px ${COLORS.green}60, 0 0 60px #8b5cf640`,
        }}
      />
      {/* LED strip bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, #8b5cf6, ${COLORS.green}, #8b5cf6)`,
          opacity: neonPulse2,
          boxShadow: `0 0 20px #8b5cf660`,
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
            backgroundColor: "#0a0a1a",
            borderRadius: 6,
            border: `2px solid ${i === 1 ? COLORS.green : "#8b5cf6"}40`,
            overflow: "hidden",
            boxShadow: `0 0 20px ${i === 1 ? COLORS.green : "#8b5cf6"}15`,
          }}
        >
          {/* Screen content */}
          {[0, 1, 2, 3].map((j) => (
            <div
              key={j}
              style={{
                position: "absolute",
                left: 8 + (j % 2) * 6,
                top: 10 + j * 22,
                width: 30 + ((j + i) * 19) % 60,
                height: 4,
                backgroundColor: [COLORS.green, "#8b5cf6", "#f472b6", "#fbbf24"][(j + i) % 4],
                borderRadius: 2,
                opacity: 0.6,
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
          height: 10,
          backgroundColor: "#1e1b4b",
          borderRadius: 4,
        }}
      />
      {/* Mech keyboard glow */}
      <div
        style={{
          position: "absolute",
          bottom: 210,
          left: 300,
          width: 200,
          height: 15,
          borderRadius: 4,
          background: `linear-gradient(90deg, ${COLORS.green}30, #8b5cf630, ${COLORS.green}30)`,
          boxShadow: `0 -5px 15px ${COLORS.green}15`,
        }}
      />
    </AbsoluteFill>
  );
};

const RooftopSunset: React.FC<{ frame: number }> = ({ frame }) => {
  const glowPulse = 0.8 + Math.sin(frame * 0.05) * 0.2;

  return (
    <AbsoluteFill>
      {/* Sunset sky */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #7c3aed20 0%, #f97316 15%, #fb923c 30%, #fbbf24 45%, #fde68a 60%, #fed7aa 80%, #e2e8f0 100%)",
        }}
      />
      {/* Sun */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "25%",
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle, #fef08a 0%, #f97316 60%, #f9731600 100%)",
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
            backgroundColor: `rgba(30, 27, 75, ${0.7 + (i % 3) * 0.1})`,
            borderRadius: "4px 4px 0 0",
          }}
        >
          {/* Windows */}
          {Array.from({ length: Math.floor(bldg.h / 40) }).map((_, j) =>
            Array.from({ length: Math.floor(bldg.w / 20) }).map((_, k) => (
              <div
                key={`${j}-${k}`}
                style={{
                  position: "absolute",
                  left: 6 + k * 18,
                  top: 10 + j * 35,
                  width: 8,
                  height: 12,
                  backgroundColor: (i + j + k) % 3 === 0 ? "#fbbf2440" : "#fbbf2415",
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
          height: 4,
          backgroundColor: "#78716c",
        }}
      />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: 120,
            left: 80 + i * 170,
            width: 4,
            height: 34,
            backgroundColor: "#78716c",
            borderRadius: 2,
          }}
        />
      ))}
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
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(20px)",
        padding: "14px 28px",
        borderRadius: 60,
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
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
            color: "#aaa",
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
          backgroundColor: "rgba(0,0,0,0.15)",
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
            fontSize: 28,
            color: COLORS.white,
            fontFamily: FONT,
            fontWeight: 700,
            margin: "12px 0 0 0",
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
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
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)",
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
          }}
        >
          App Market
        </h1>
        <p
          style={{
            fontSize: 28,
            color: "#9ca3af",
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
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)",
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
                  border: `2px solid rgba(255,255,255,0.1)`,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
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
                  fontSize: 22,
                  color: COLORS.white,
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
                  color: "#9ca3af",
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
        background: `linear-gradient(${gradAngle}deg, #0f0f23 0%, #0a1628 50%, #0f0f23 100%)`,
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
          background: `radial-gradient(circle, ${COLORS.green}10 0%, transparent 70%)`,
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
    <AbsoluteFill style={{ backgroundColor: "#0f0f23" }}>
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
        <TransitionWipe color="#0f0f23" />
      </Sequence>

      {/* CTA */}
      <Sequence from={ctaStart} durationInFrames={CTA}>
        <CTAFinal />
      </Sequence>
    </AbsoluteFill>
  );
};
