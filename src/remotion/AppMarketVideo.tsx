import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  Audio,
  staticFile,
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
// BEAT TIMING CONSTANTS
// Main beat: 60 frames (2s) | Secondary: 30 frames (1s) | Sub-beat: 15 frames (0.5s)
// ============================================
const MAIN_BEAT = 60;
const SEC_BEAT = 30;
const SUB_BEAT = 15;

// Snappy pop-in animation helper
const snapIn = (frame: number, startFrame: number, duration = 5) => {
  const opacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [startFrame, startFrame + duration], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [startFrame, startFrame + duration], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, scale, y };
};

// ============================================
// SCENE 1: Title Reveal
// ============================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 0: Title pops in
  const title = snapIn(frame, 0, 8);
  const titleSpring = spring({ frame, fps, config: { damping: 8, stiffness: 150 } });

  // Sub-beat 15: Line expands
  const lineWidth = interpolate(frame, [SUB_BEAT, SUB_BEAT + 10], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Secondary beat 30: Subtitle pops
  const subtitle = snapIn(frame, SEC_BEAT, 6);

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
            opacity: title.opacity,
            transform: `scale(${interpolate(titleSpring, [0, 1], [0.8, 1])})`,
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
            opacity: subtitle.opacity,
            transform: `translateY(${subtitle.y}px) scale(${subtitle.scale})`,
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

  // Beat 0: Line 1 snaps in
  const line1 = snapIn(frame, 0, 5);
  // Sub-beat 15: Line 2 snaps in
  const line2 = snapIn(frame, SUB_BEAT, 5);
  // Secondary beat 30: Line 3 snaps in (the hook)
  const line3 = snapIn(frame, SEC_BEAT, 5);

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
            opacity: line1.opacity,
            transform: `translateY(${line1.y}px) scale(${line1.scale})`,
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
            opacity: line2.opacity,
            transform: `translateY(${line2.y}px) scale(${line2.scale})`,
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
            opacity: line3.opacity,
            transform: `translateY(${line3.y}px) scale(${line3.scale})`,
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

  // Beat 0: Title snaps in
  const titleAnim = snapIn(frame, 0, 5);

  // Steps on sub-beats: 10, 20, 30, 40, 50
  const steps = [
    { icon: "📝", text: "List your project", delay: 10 },
    { icon: "✓", text: "Verify GitHub ownership", delay: 20 },
    { icon: "💰", text: "Receive bids", delay: 30 },
    { icon: "🔒", text: "Funds held in escrow", delay: 40 },
    { icon: "⚡", text: "Get paid instantly", delay: 50 },
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
            opacity: titleAnim.opacity,
            transform: `scale(${titleAnim.scale})`,
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
            opacity: titleAnim.opacity,
            transform: `scale(${titleAnim.scale})`,
          }}
        >
          Turn side projects into cash
        </h2>
        <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
          {steps.map((step, i) => {
            const anim = snapIn(frame, step.delay, 4);
            const popSpring = spring({
              frame: frame - step.delay,
              fps,
              config: { damping: 8, stiffness: 200 },
            });

            return (
              <div
                key={i}
                style={{
                  opacity: anim.opacity,
                  transform: `scale(${interpolate(popSpring, [0, 1], [0.5, 1])})`,
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

  // Beat 0: Title snaps in
  const titleAnim = snapIn(frame, 0, 5);

  const features = [
    { title: "Skip months of dev", desc: "Buy working products", delay: 10 },
    { title: "Verified sellers", desc: "GitHub ownership proven", delay: 20 },
    { title: "Protected funds", desc: "Blockchain escrow", delay: 30 },
    { title: "Global access", desc: "No borders, no limits", delay: 40 },
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
            opacity: titleAnim.opacity,
            transform: `scale(${titleAnim.scale})`,
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
            opacity: titleAnim.opacity,
            transform: `scale(${titleAnim.scale})`,
          }}
        >
          Find your next project
        </h2>
        <div style={{ display: "flex", gap: 60, justifyContent: "center" }}>
          {features.map((feature, i) => {
            const anim = snapIn(frame, feature.delay, 4);
            const popSpring = spring({
              frame: frame - feature.delay,
              fps,
              config: { damping: 8, stiffness: 200 },
            });

            return (
              <div
                key={i}
                style={{
                  opacity: anim.opacity,
                  transform: `scale(${interpolate(popSpring, [0, 1], [0.5, 1])})`,
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

  // Beat 0: Title snaps
  const titleAnim = snapIn(frame, 0, 5);

  // Sub-beat sequence for escrow flow
  const sellerAnim = snapIn(frame, 12, 4);
  const arrow1Anim = snapIn(frame, 20, 3);
  const escrowAnim = snapIn(frame, 28, 4);
  const arrow2Anim = snapIn(frame, 36, 3);
  const buyerAnim = snapIn(frame, 44, 4);

  // Escrow pulse on beats
  const escrowPulse = frame > 28 ? 1 + Math.sin((frame - 28) * 0.15) * 0.03 : 1;

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
            opacity: titleAnim.opacity,
            transform: `scale(${titleAnim.scale})`,
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
            opacity: titleAnim.opacity,
          }}
        >
          Smart contracts hold funds. No middleman. No risk.
        </p>

        {/* Escrow Flow Diagram */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
          {/* Seller */}
          <div style={{ opacity: sellerAnim.opacity, textAlign: "center", transform: `scale(${sellerAnim.scale})` }}>
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
          <div style={{ opacity: arrow1Anim.opacity, display: "flex", alignItems: "center", transform: `scaleX(${arrow1Anim.scale})` }}>
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
          <div style={{ opacity: escrowAnim.opacity, textAlign: "center", transform: `scale(${escrowAnim.scale * escrowPulse})` }}>
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
          <div style={{ opacity: arrow2Anim.opacity, display: "flex", alignItems: "center", transform: `scaleX(${arrow2Anim.scale})` }}>
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
          <div style={{ opacity: buyerAnim.opacity, textAlign: "center", transform: `scale(${buyerAnim.scale})` }}>
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
  const { fps } = useVideoConfig();

  // Stats pop on rapid sub-beats: 0, 8, 16, 24
  const stats = [
    { value: "3-5%", label: "Platform fee", delay: 0 },
    { value: "2s", label: "Settlement", delay: 8 },
    { value: "100%", label: "Trustless escrow", delay: 16 },
    { value: "24/7", label: "Always live", delay: 24 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 100, justifyContent: "center" }}>
        {stats.map((stat, i) => {
          const popSpring = spring({
            frame: frame - stat.delay,
            fps,
            config: { damping: 8, stiffness: 180 },
          });
          const anim = snapIn(frame, stat.delay, 4);

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity: anim.opacity,
                transform: `scale(${interpolate(popSpring, [0, 1], [0.3, 1])})`,
              }}
            >
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

  // Beat 0: Logo pops
  const logoSpring = spring({ frame, fps, config: { damping: 8, stiffness: 150 } });
  const logoAnim = snapIn(frame, 0, 5);

  // Sub-beat 15: CTA text
  const ctaAnim = snapIn(frame, SUB_BEAT, 5);

  // Secondary beat 30: URL button pops
  const urlAnim = snapIn(frame, SEC_BEAT, 5);
  const urlSpring = spring({ frame: frame - SEC_BEAT, fps, config: { damping: 8, stiffness: 150 } });

  // Sub-beat 45: Mainnet text
  const mainnetAnim = snapIn(frame, 45, 5);

  // Sub-beat 55: More info
  const moreInfoAnim = snapIn(frame, 55, 5);

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
            opacity: logoAnim.opacity,
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.5, 1])})`,
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
            opacity: ctaAnim.opacity,
            transform: `translateY(${ctaAnim.y}px) scale(${ctaAnim.scale})`,
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
            opacity: urlAnim.opacity,
            transform: `scale(${interpolate(urlSpring, [0, 1], [0.5, 1])})`,
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
            opacity: mainnetAnim.opacity,
            transform: `scale(${mainnetAnim.scale})`,
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
            opacity: moreInfoAnim.opacity,
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
      {/* Background Music */}
      <Audio src={staticFile("audio/background.mp3")} volume={1} />

      {/* Scene timings: Main beat every 2s (60 frames) */}
      {/* Transitions happen ON the beat */}

      {/* Scene 1: Title - 0-4s (frames 0-120) */}
      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Problem - 4-6s (frames 120-180) - shorter, punchier */}
      <Sequence from={120} durationInFrames={60}>
        <ProblemScene />
      </Sequence>

      {/* Scene 3: Sellers - 6-10s (frames 180-300) */}
      <Sequence from={180} durationInFrames={120}>
        <SellerScene />
      </Sequence>

      {/* Scene 4: Buyers - 10-14s (frames 300-420) */}
      <Sequence from={300} durationInFrames={120}>
        <BuyerScene />
      </Sequence>

      {/* Scene 5: Trust/Escrow - 14-18s (frames 420-540) */}
      <Sequence from={420} durationInFrames={120}>
        <TrustScene />
      </Sequence>

      {/* Scene 6: Stats - 18-20s (frames 540-600) - quick impact */}
      <Sequence from={540} durationInFrames={60}>
        <StatsScene />
      </Sequence>

      {/* Scene 7: CTA - 20-30s (frames 600-900) - longer ending */}
      <Sequence from={600} durationInFrames={300}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
