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

// Brand colors
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

// ============================================
// SCENE 1: Title Reveal
// ============================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 50, stiffness: 100, mass: 0.5 },
  });

  const titleY = interpolate(titleProgress, [0, 1], [80, 0]);
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [25, 45], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const lineWidth = interpolate(frame, [50, 80], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: 140,
            fontWeight: 700,
            color: COLORS.green,
            margin: 0,
            fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
            letterSpacing: "-0.03em",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          App Market
        </h1>
        <div
          style={{
            width: lineWidth,
            height: 4,
            background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.emerald}, ${COLORS.teal})`,
            margin: "30px auto",
            borderRadius: 2,
          }}
        />
        <p
          style={{
            fontSize: 36,
            color: COLORS.gray,
            margin: 0,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 400,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          Buy & Sell Apps. Secured by Solana.
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: The Problem
// ============================================
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  const line1Opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const line1Y = interpolate(frame, [0, 20], [40, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line2Y = interpolate(frame, [30, 50], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const line3Opacity = interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line3Y = interpolate(frame, [60, 80], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 1200, padding: "0 60px" }}>
        <p
          style={{
            fontSize: 64,
            color: COLORS.black,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            lineHeight: 1.3,
            margin: 0,
            opacity: line1Opacity,
            transform: `translateY(${line1Y}px)`,
          }}
        >
          You built something great.
        </p>
        <p
          style={{
            fontSize: 64,
            color: COLORS.black,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            lineHeight: 1.3,
            margin: "20px 0 0 0",
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
          }}
        >
          But you don't have time to maintain it.
        </p>
        <p
          style={{
            fontSize: 64,
            color: COLORS.green,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            lineHeight: 1.3,
            margin: "20px 0 0 0",
            opacity: line3Opacity,
            transform: `translateY(${line3Y}px)`,
          }}
        >
          What if you could sell it today?
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: For Sellers
// ============================================
const SellerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const steps = [
    { icon: "📝", text: "List your project", delay: 20 },
    { icon: "✓", text: "Verify GitHub ownership", delay: 40 },
    { icon: "💰", text: "Receive bids", delay: 60 },
    { icon: "🔒", text: "Funds held in escrow", delay: 80 },
    { icon: "⚡", text: "Get paid instantly", delay: 100 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 28,
            color: COLORS.green,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            margin: 0,
            opacity: titleOpacity,
          }}
        >
          For Sellers
        </p>
        <h2
          style={{
            fontSize: 72,
            color: COLORS.green,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            margin: "20px 0 60px 0",
            opacity: titleOpacity,
          }}
        >
          Turn side projects into cash
        </h2>
        <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
          {steps.map((step, i) => {
            const stepOpacity = interpolate(frame, [step.delay, step.delay + 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const stepY = interpolate(frame, [step.delay, step.delay + 15], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const stepScale = spring({
              frame: frame - step.delay,
              fps,
              config: { damping: 12, stiffness: 200 },
            });

            return (
              <div
                key={i}
                style={{
                  opacity: stepOpacity,
                  transform: `translateY(${stepY}px) scale(${interpolate(stepScale, [0, 1], [0.8, 1])})`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 24,
                    backgroundColor: COLORS.lightGray,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 48,
                    marginBottom: 16,
                  }}
                >
                  {step.icon}
                </div>
                <p
                  style={{
                    fontSize: 20,
                    color: COLORS.black,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    fontWeight: 500,
                    margin: 0,
                    maxWidth: 120,
                  }}
                >
                  {step.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: For Buyers
// ============================================
const BuyerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const features = [
    { title: "Skip months of dev", desc: "Buy working products" },
    { title: "Verified sellers", desc: "GitHub ownership proven" },
    { title: "Protected funds", desc: "Blockchain escrow" },
    { title: "Global access", desc: "No borders, no limits" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 28,
            color: COLORS.green,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            margin: 0,
            opacity: titleOpacity,
          }}
        >
          For Buyers
        </p>
        <h2
          style={{
            fontSize: 72,
            color: COLORS.green,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            margin: "20px 0 60px 0",
            opacity: titleOpacity,
          }}
        >
          Find your next project
        </h2>
        <div style={{ display: "flex", gap: 60, justifyContent: "center" }}>
          {features.map((feature, i) => {
            const delay = 20 + i * 20;
            const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const y = interpolate(frame, [delay, delay + 15], [40, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${y}px)`,
                  textAlign: "center",
                  maxWidth: 200,
                }}
              >
                <h3
                  style={{
                    fontSize: 28,
                    color: COLORS.black,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: 20,
                    color: COLORS.gray,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    fontWeight: 400,
                    margin: "8px 0 0 0",
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5: Trust / Escrow
// ============================================
const TrustScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Animated escrow flow
  const sellerOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrow1 = interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const escrowOpacity = interpolate(frame, [60, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrow2 = interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const buyerOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const escrowPulse = Math.sin(frame * 0.1) * 0.05 + 1;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            fontSize: 72,
            color: COLORS.green,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 600,
            margin: "0 0 20px 0",
            opacity: titleOpacity,
          }}
        >
          Trustless by design
        </h2>
        <p
          style={{
            fontSize: 32,
            color: COLORS.gray,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            margin: "0 0 80px 0",
            opacity: titleOpacity,
          }}
        >
          Smart contracts hold funds. No middleman. No risk.
        </p>

        {/* Escrow Flow Diagram */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
          {/* Seller */}
          <div style={{ opacity: sellerOpacity, textAlign: "center" }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: COLORS.lightGray,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                marginBottom: 12,
              }}
            >
              👤
            </div>
            <p style={{ fontSize: 24, color: COLORS.black, fontFamily: "SF Pro Display, sans-serif", fontWeight: 500, margin: 0 }}>Seller</p>
          </div>

          {/* Arrow 1 */}
          <div style={{ opacity: arrow1, display: "flex", alignItems: "center" }}>
            <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "10px solid transparent",
                borderBottom: "10px solid transparent",
                borderLeft: `16px solid ${COLORS.green}`,
              }}
            />
          </div>

          {/* Escrow */}
          <div style={{ opacity: escrowOpacity, textAlign: "center", transform: `scale(${escrowPulse})` }}>
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 28,
                background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                marginBottom: 12,
                boxShadow: `0 20px 60px ${COLORS.green}40`,
              }}
            >
              🔒
            </div>
            <p style={{ fontSize: 24, color: COLORS.green, fontFamily: "SF Pro Display, sans-serif", fontWeight: 600, margin: 0 }}>Escrow</p>
          </div>

          {/* Arrow 2 */}
          <div style={{ opacity: arrow2, display: "flex", alignItems: "center" }}>
            <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "10px solid transparent",
                borderBottom: "10px solid transparent",
                borderLeft: `16px solid ${COLORS.green}`,
              }}
            />
          </div>

          {/* Buyer */}
          <div style={{ opacity: buyerOpacity, textAlign: "center" }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: COLORS.lightGray,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                marginBottom: 12,
              }}
            >
              👤
            </div>
            <p style={{ fontSize: 24, color: COLORS.black, fontFamily: "SF Pro Display, sans-serif", fontWeight: 500, margin: 0 }}>Buyer</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 6: Stats
// ============================================
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();

  const stats = [
    { value: "3-5%", label: "Platform fee", delay: 0 },
    { value: "2s", label: "Settlement", delay: 20 },
    { value: "100%", label: "On-chain", delay: 40 },
    { value: "24/7", label: "Always live", delay: 60 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 100, justifyContent: "center" }}>
        {stats.map((stat, i) => {
          const opacity = interpolate(frame, [stat.delay, stat.delay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(frame, [stat.delay, stat.delay + 20], [0.5, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div key={i} style={{ textAlign: "center", opacity, transform: `scale(${scale})` }}>
              <p
                style={{
                  fontSize: 96,
                  color: COLORS.green,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </p>
              <p
                style={{
                  fontSize: 28,
                  color: COLORS.gray,
                  fontFamily: "SF Pro Display, -apple-system, sans-serif",
                  fontWeight: 400,
                  margin: "12px 0 0 0",
                }}
              >
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 7: Call to Action
// ============================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  const ctaOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [30, 50], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const mainnetOpacity = interpolate(frame, [90, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const moreInfoOpacity = interpolate(frame, [100, 115], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: COLORS.green,
            margin: 0,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            letterSpacing: "-0.03em",
            opacity: logoOpacity,
            transform: `scale(${interpolate(logoScale, [0, 1], [0.8, 1])})`,
          }}
        >
          App Market
        </h1>
        <p
          style={{
            fontSize: 48,
            color: COLORS.black,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 500,
            margin: "40px 0",
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
          }}
        >
          Start building your future.
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "20px 60px",
            background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`,
            borderRadius: 100,
            opacity: urlOpacity,
            boxShadow: `0 20px 60px ${COLORS.green}40`,
          }}
        >
          <p
            style={{
              fontSize: 32,
              color: COLORS.white,
              fontFamily: "SF Pro Display, -apple-system, sans-serif",
              fontWeight: 600,
              margin: 0,
            }}
          >
            appmrkt.xyz
          </p>
        </div>
        <p
          style={{
            fontSize: 18,
            color: COLORS.gray,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            margin: "40px 0 0 0",
            opacity: mainnetOpacity,
          }}
        >
          mainnet prepared
        </p>
        <p
          style={{
            fontSize: 16,
            color: COLORS.gray,
            fontFamily: "SF Pro Display, -apple-system, sans-serif",
            fontWeight: 400,
            margin: "12px 0 0 0",
            opacity: moreInfoOpacity,
          }}
        >
          more information soon
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN VIDEO COMPOSITION
// ============================================
export const AppMarketVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white }}>
      {/* Scene 1: Title - 0 to 120 frames (4 seconds) */}
      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Problem - 120 to 240 frames (4 seconds) */}
      <Sequence from={120} durationInFrames={120}>
        <ProblemScene />
      </Sequence>

      {/* Scene 3: Sellers - 240 to 390 frames (5 seconds) */}
      <Sequence from={240} durationInFrames={150}>
        <SellerScene />
      </Sequence>

      {/* Scene 4: Buyers - 390 to 510 frames (4 seconds) */}
      <Sequence from={390} durationInFrames={120}>
        <BuyerScene />
      </Sequence>

      {/* Scene 5: Trust/Escrow - 510 to 660 frames (5 seconds) */}
      <Sequence from={510} durationInFrames={150}>
        <TrustScene />
      </Sequence>

      {/* Scene 6: Stats - 660 to 780 frames (4 seconds) */}
      <Sequence from={660} durationInFrames={120}>
        <StatsScene />
      </Sequence>

      {/* Scene 7: CTA - 780 to 900 frames (4 seconds) */}
      <Sequence from={780} durationInFrames={120}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
