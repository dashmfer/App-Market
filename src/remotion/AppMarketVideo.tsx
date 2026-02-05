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
// BEAT = 30 FRAMES (1 SECOND)
// Every element pops on exact 1-second intervals
// ============================================
const BEAT = 30;

// Snappy pop-in animation - very fast (4 frames)
const snapIn = (frame: number, startFrame: number) => {
  const duration = 4;
  const opacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [startFrame, startFrame + duration], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, scale };
};

// ============================================
// SCENE 1: Title (0-4s, frames 0-120)
// Beats at: 0, 1, 2, 3 seconds
// ============================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 0 (0s): Title
  const title = snapIn(frame, 0);
  const titleSpring = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

  // Beat 1 (1s): Line
  const lineWidth = interpolate(frame, [BEAT, BEAT + 4], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat 2 (2s): Subtitle
  const subtitle = snapIn(frame, BEAT * 2);

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
            transform: `scale(${interpolate(titleSpring, [0, 1], [0.5, 1])})`,
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
            transform: `scale(${subtitle.scale})`,
          }}
        >
          Buy & Sell Apps. Secured by Solana.
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: Problem (4-8s, frames 120-240)
// Beats at: 4, 5, 6, 7 seconds (relative 0, 30, 60, 90)
// ============================================
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Beat 0 (4s): Line 1
  const line1 = snapIn(frame, 0);
  // Beat 1 (5s): Line 2
  const line2 = snapIn(frame, BEAT);
  // Beat 2 (6s): Line 3
  const line3 = snapIn(frame, BEAT * 2);

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
            transform: `scale(${line1.scale})`,
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
            transform: `scale(${line2.scale})`,
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
            transform: `scale(${line3.scale})`,
          }}
        >
          What if you could sell it today?
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: For Sellers (8-12s, frames 240-360)
// Beats at: 8, 9, 10, 11 seconds (relative 0, 30, 60, 90)
// ============================================
const SellerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 0 (8s): Title
  const titleAnim = snapIn(frame, 0);

  // Beat 1 (9s): Icons 1 & 2
  // Beat 2 (10s): Icons 3 & 4
  // Beat 3 (11s): Icon 5
  const steps = [
    { icon: "📝", text: "List your project", beat: 1 },
    { icon: "✓", text: "Verify GitHub", beat: 1 },
    { icon: "💰", text: "Receive bids", beat: 2 },
    { icon: "🔒", text: "Funds in escrow", beat: 2 },
    { icon: "⚡", text: "Get paid instantly", beat: 3 },
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
            const startFrame = step.beat * BEAT;
            const anim = snapIn(frame, startFrame);
            const popSpring = spring({
              frame: frame - startFrame,
              fps,
              config: { damping: 8, stiffness: 200 },
            });

            return (
              <div
                key={i}
                style={{
                  opacity: anim.opacity,
                  transform: `scale(${interpolate(popSpring, [0, 1], [0.3, 1])})`,
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
                    fontSize: 18,
                    color: COLORS.black,
                    fontFamily: "SF Pro Display, -apple-system, sans-serif",
                    fontWeight: 500,
                    margin: 0,
                    maxWidth: 100,
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
// SCENE 4: For Buyers (12-16s, frames 360-480)
// Beats at: 12, 13, 14, 15 seconds (relative 0, 30, 60, 90)
// ============================================
const BuyerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 0 (12s): Title
  const titleAnim = snapIn(frame, 0);

  // Beat 1 (13s): Features 1 & 2
  // Beat 2 (14s): Features 3 & 4
  const features = [
    { title: "Skip months of dev", desc: "Buy working products", beat: 1 },
    { title: "Verified sellers", desc: "GitHub ownership proven", beat: 1 },
    { title: "Protected funds", desc: "Blockchain escrow", beat: 2 },
    { title: "Global access", desc: "No borders, no limits", beat: 2 },
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
            const startFrame = feature.beat * BEAT;
            const anim = snapIn(frame, startFrame);
            const popSpring = spring({
              frame: frame - startFrame,
              fps,
              config: { damping: 8, stiffness: 200 },
            });

            return (
              <div
                key={i}
                style={{
                  opacity: anim.opacity,
                  transform: `scale(${interpolate(popSpring, [0, 1], [0.3, 1])})`,
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
// SCENE 5: Trust/Escrow (16-21s, frames 480-630)
// Beats at: 16, 17, 18, 19, 20 seconds (relative 0, 30, 60, 90, 120)
// ============================================
const TrustScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Beat 0 (16s): Title
  const titleAnim = snapIn(frame, 0);
  // Beat 1 (17s): Seller
  const sellerAnim = snapIn(frame, BEAT);
  // Beat 2 (18s): Arrow + Escrow
  const escrowAnim = snapIn(frame, BEAT * 2);
  // Beat 3 (19s): Arrow + Buyer
  const buyerAnim = snapIn(frame, BEAT * 3);

  // Escrow pulse
  const escrowPulse = frame > BEAT * 2 ? 1 + Math.sin((frame - BEAT * 2) * 0.15) * 0.03 : 1;

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
          Smart contracts hold funds. No middleman.
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
          <div style={{ opacity: escrowAnim.opacity, display: "flex", alignItems: "center", transform: `scaleX(${escrowAnim.scale})` }}>
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
          <div style={{ opacity: buyerAnim.opacity, display: "flex", alignItems: "center", transform: `scaleX(${buyerAnim.scale})` }}>
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
// SCENE 6: Stats (21-25s, frames 630-750)
// Beats at: 21, 22, 23, 24 seconds (relative 0, 30, 60, 90)
// ============================================
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each stat pops on its own beat
  const stats = [
    { value: "3-5%", label: "Platform fee", beat: 0 },
    { value: "2s", label: "Settlement", beat: 1 },
    { value: "100%", label: "Trustless escrow", beat: 2 },
    { value: "24/7", label: "Always live", beat: 3 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 100, justifyContent: "center" }}>
        {stats.map((stat, i) => {
          const startFrame = stat.beat * BEAT;
          const popSpring = spring({
            frame: frame - startFrame,
            fps,
            config: { damping: 8, stiffness: 180 },
          });
          const anim = snapIn(frame, startFrame);

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
// SCENE 7: CTA (25-30s, frames 750-900)
// Beats at: 25, 26, 27, 28, 29 seconds (relative 0, 30, 60, 90, 120)
// ============================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 0 (25s): Logo
  const logoAnim = snapIn(frame, 0);
  const logoSpring = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

  // Beat 1 (26s): CTA text
  const ctaAnim = snapIn(frame, BEAT);

  // Beat 2 (27s): URL button
  const urlAnim = snapIn(frame, BEAT * 2);
  const urlSpring = spring({ frame: frame - BEAT * 2, fps, config: { damping: 8, stiffness: 200 } });

  // Beat 3 (28s): Mainnet
  const mainnetAnim = snapIn(frame, BEAT * 3);

  // Beat 4 (29s): More info
  const moreInfoAnim = snapIn(frame, BEAT * 4);

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
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.3, 1])})`,
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
            transform: `scale(${ctaAnim.scale})`,
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
            transform: `scale(${interpolate(urlSpring, [0, 1], [0.3, 1])})`,
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
            transform: `scale(${moreInfoAnim.scale})`,
          }}
        >
          more information soon
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN VIDEO COMPOSITION - 30 seconds total
// Scene transitions on exact second boundaries
// ============================================
export const AppMarketVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white }}>
      {/* Background Music */}
      <Audio src={staticFile("audio/background.mp3")} volume={1} />

      {/* Scene 1: Title - 0-4s (beats 0,1,2,3) */}
      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Problem - 4-8s (beats 4,5,6,7) */}
      <Sequence from={120} durationInFrames={120}>
        <ProblemScene />
      </Sequence>

      {/* Scene 3: Sellers - 8-12s (beats 8,9,10,11) */}
      <Sequence from={240} durationInFrames={120}>
        <SellerScene />
      </Sequence>

      {/* Scene 4: Buyers - 12-16s (beats 12,13,14,15) */}
      <Sequence from={360} durationInFrames={120}>
        <BuyerScene />
      </Sequence>

      {/* Scene 5: Trust/Escrow - 16-21s (beats 16,17,18,19,20) */}
      <Sequence from={480} durationInFrames={150}>
        <TrustScene />
      </Sequence>

      {/* Scene 6: Stats - 21-25s (beats 21,22,23,24) */}
      <Sequence from={630} durationInFrames={120}>
        <StatsScene />
      </Sequence>

      {/* Scene 7: CTA - 25-30s (beats 25,26,27,28,29) */}
      <Sequence from={750} durationInFrames={150}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
