import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import React from "react";

const COLORS = {
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  white: "#ffffff",
  black: "#000000",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
};

// Pop animation helper
const pop = (frame: number) => {
  const opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 8], [0.5, 1], { extrapolateRight: "clamp" });
  return { opacity, scale };
};

// ========== TITLE SCENE ELEMENTS ==========
export const TitleMain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = pop(frame);
  const titleSpring = spring({ frame, fps, config: { damping: 8, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <h1 style={{
        fontSize: 140, fontWeight: 700, color: COLORS.green, margin: 0,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity,
        transform: `scale(${interpolate(titleSpring, [0, 1], [0.8, 1])})`,
      }}>
        App Market
      </h1>
    </AbsoluteFill>
  );
};

export const TitleLine: React.FC = () => {
  const frame = useCurrentFrame();
  const lineWidth = interpolate(frame, [0, 10], [0, 200], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        width: lineWidth, height: 4,
        background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.emerald}, ${COLORS.teal})`,
        borderRadius: 2,
      }} />
    </AbsoluteFill>
  );
};

export const TitleSubtitle: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 36, color: COLORS.gray, margin: 0,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity, transform: `scale(${anim.scale})`,
      }}>
        Buy & Sell Apps. Secured by Solana.
      </p>
    </AbsoluteFill>
  );
};

// ========== PROBLEM SCENE ELEMENTS ==========
export const ProblemLine1: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 64, color: COLORS.black, fontWeight: 600,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity, transform: `scale(${anim.scale})`,
      }}>
        You built something great.
      </p>
    </AbsoluteFill>
  );
};

export const ProblemLine2: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 64, color: COLORS.black, fontWeight: 600,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity, transform: `scale(${anim.scale})`,
      }}>
        But you don't have time to maintain it.
      </p>
    </AbsoluteFill>
  );
};

export const ProblemLine3: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 64, color: COLORS.green, fontWeight: 600,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity, transform: `scale(${anim.scale})`,
      }}>
        What if you could sell it today?
      </p>
    </AbsoluteFill>
  );
};

// ========== SELLER SCENE ELEMENTS ==========
export const SellerTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", opacity: anim.opacity, transform: `scale(${anim.scale})` }}>
        <p style={{ fontSize: 28, color: COLORS.green, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>
          For Sellers
        </p>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontWeight: 600, margin: "20px 0 0 0", fontFamily: "SF Pro Display, sans-serif" }}>
          Turn side projects into cash
        </h2>
      </div>
    </AbsoluteFill>
  );
};

const SellerIcon: React.FC<{ icon: string; text: string }> = ({ icon, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = pop(frame);
  const popSpring = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: anim.opacity, transform: `scale(${interpolate(popSpring, [0, 1], [0.5, 1])})`, textAlign: "center" }}>
        <div style={{
          width: 100, height: 100, borderRadius: 24, backgroundColor: COLORS.lightGray,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 16,
        }}>
          {icon}
        </div>
        <p style={{ fontSize: 20, color: COLORS.black, fontWeight: 500, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const SellerIcon1: React.FC = () => <SellerIcon icon="📝" text="List your project" />;
export const SellerIcon2: React.FC = () => <SellerIcon icon="✓" text="Verify GitHub ownership" />;
export const SellerIcon3: React.FC = () => <SellerIcon icon="💰" text="Receive bids" />;
export const SellerIcon4: React.FC = () => <SellerIcon icon="🔒" text="Funds held in escrow" />;
export const SellerIcon5: React.FC = () => <SellerIcon icon="⚡" text="Get paid instantly" />;

// ========== BUYER SCENE ELEMENTS ==========
export const BuyerTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", opacity: anim.opacity, transform: `scale(${anim.scale})` }}>
        <p style={{ fontSize: 28, color: COLORS.green, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>
          For Buyers
        </p>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontWeight: 600, margin: "20px 0 0 0", fontFamily: "SF Pro Display, sans-serif" }}>
          Find your next project
        </h2>
      </div>
    </AbsoluteFill>
  );
};

const BuyerFeature: React.FC<{ title: string; desc: string }> = ({ title, desc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = pop(frame);
  const popSpring = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: anim.opacity, transform: `scale(${interpolate(popSpring, [0, 1], [0.5, 1])})`, textAlign: "center" }}>
        <h3 style={{ fontSize: 28, color: COLORS.black, fontWeight: 600, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>
          {title}
        </h3>
        <p style={{ fontSize: 20, color: COLORS.gray, fontWeight: 400, margin: "8px 0 0 0", fontFamily: "SF Pro Display, sans-serif" }}>
          {desc}
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const BuyerFeature1: React.FC = () => <BuyerFeature title="Skip months of dev" desc="Buy working products" />;
export const BuyerFeature2: React.FC = () => <BuyerFeature title="Verified sellers" desc="GitHub ownership proven" />;
export const BuyerFeature3: React.FC = () => <BuyerFeature title="Protected funds" desc="Blockchain escrow" />;
export const BuyerFeature4: React.FC = () => <BuyerFeature title="Global access" desc="No borders, no limits" />;

// ========== TRUST SCENE ELEMENTS ==========
export const TrustTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", opacity: anim.opacity, transform: `scale(${anim.scale})` }}>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontWeight: 600, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>
          Trustless by design
        </h2>
        <p style={{ fontSize: 32, color: COLORS.gray, margin: "20px 0 0 0", fontFamily: "SF Pro Display, sans-serif" }}>
          Smart contracts hold funds. No middleman. No risk.
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const TrustSeller: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: anim.opacity, transform: `scale(${anim.scale})`, textAlign: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", backgroundColor: COLORS.lightGray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 12 }}>
          👤
        </div>
        <p style={{ fontSize: 24, color: COLORS.black, fontWeight: 500, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>Seller</p>
      </div>
    </AbsoluteFill>
  );
};

export const TrustEscrow: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: anim.opacity, transform: `scale(${anim.scale})`, textAlign: "center" }}>
        <div style={{
          width: 140, height: 140, borderRadius: 28,
          background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, marginBottom: 12,
          boxShadow: `0 20px 60px ${COLORS.green}40`,
        }}>
          🔒
        </div>
        <p style={{ fontSize: 24, color: COLORS.green, fontWeight: 600, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>Escrow</p>
      </div>
    </AbsoluteFill>
  );
};

export const TrustBuyer: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: anim.opacity, transform: `scale(${anim.scale})`, textAlign: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", backgroundColor: COLORS.lightGray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 12 }}>
          👤
        </div>
        <p style={{ fontSize: 24, color: COLORS.black, fontWeight: 500, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>Buyer</p>
      </div>
    </AbsoluteFill>
  );
};

export const TrustArrow: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: anim.opacity, transform: `scaleX(${anim.scale})`, display: "flex", alignItems: "center" }}>
        <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
        <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `16px solid ${COLORS.green}` }} />
      </div>
    </AbsoluteFill>
  );
};

// ========== STATS SCENE ELEMENTS ==========
const StatItem: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = pop(frame);
  const popSpring = spring({ frame, fps, config: { damping: 8, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", opacity: anim.opacity, transform: `scale(${interpolate(popSpring, [0, 1], [0.3, 1])})` }}>
        <p style={{ fontSize: 96, color: COLORS.green, fontWeight: 700, margin: 0, lineHeight: 1, fontFamily: "SF Pro Display, sans-serif" }}>
          {value}
        </p>
        <p style={{ fontSize: 28, color: COLORS.gray, fontWeight: 400, margin: "12px 0 0 0", fontFamily: "SF Pro Display, sans-serif" }}>
          {label}
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const Stat1: React.FC = () => <StatItem value="3-5%" label="Platform fee" />;
export const Stat2: React.FC = () => <StatItem value="2s" label="Settlement" />;
export const Stat3: React.FC = () => <StatItem value="100%" label="Trustless escrow" />;
export const Stat4: React.FC = () => <StatItem value="24/7" label="Always live" />;

// ========== CTA SCENE ELEMENTS ==========
export const CTALogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = pop(frame);
  const logoSpring = spring({ frame, fps, config: { damping: 8, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <h1 style={{
        fontSize: 120, fontWeight: 700, color: COLORS.green, margin: 0,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity,
        transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
      }}>
        App Market
      </h1>
    </AbsoluteFill>
  );
};

export const CTAText: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 48, color: COLORS.black, fontWeight: 500, margin: 0,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity, transform: `scale(${anim.scale})`,
      }}>
        Start building your future.
      </p>
    </AbsoluteFill>
  );
};

export const CTAButton: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = pop(frame);
  const urlSpring = spring({ frame, fps, config: { damping: 8, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{
        display: "inline-block", padding: "20px 60px",
        background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
        borderRadius: 100, opacity: anim.opacity,
        transform: `scale(${interpolate(urlSpring, [0, 1], [0.5, 1])})`,
        boxShadow: `0 20px 60px ${COLORS.green}40`,
      }}>
        <p style={{ fontSize: 32, color: COLORS.white, fontWeight: 600, margin: 0, fontFamily: "SF Pro Display, sans-serif" }}>
          appmrkt.xyz
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const CTAMainnet: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 18, color: COLORS.gray, fontWeight: 500,
        letterSpacing: "0.15em", textTransform: "uppercase", margin: 0,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity, transform: `scale(${anim.scale})`,
      }}>
        mainnet prepared
      </p>
    </AbsoluteFill>
  );
};

export const CTAMoreInfo: React.FC = () => {
  const frame = useCurrentFrame();
  const anim = pop(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <p style={{
        fontSize: 16, color: COLORS.gray, fontWeight: 400, margin: 0,
        fontFamily: "SF Pro Display, -apple-system, sans-serif",
        opacity: anim.opacity,
      }}>
        more information soon
      </p>
    </AbsoluteFill>
  );
};
