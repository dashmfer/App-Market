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
// EXACT BEAT FRAMES FROM USER'S AUDIO
// Seconds: 0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 21, 22, 24, 26, 27, 29
// ============================================

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
// SCENE 1: Title (0-5s, frames 0-150)
// Beats: 0s (frame 0), 2s (frame 60), 3s (frame 90)
// ============================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat at 0s (frame 0): Title
  const title = snapIn(frame, 0);
  const titleSpring = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

  // Beat at 2s (frame 60): Line
  const lineWidth = interpolate(frame, [60, 64], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Beat at 3s (frame 90): Subtitle
  const subtitle = snapIn(frame, 90);

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
// SCENE 2: Problem (5-8s, frames 150-240)
// Beats: 5s (frame 0 relative), 7s (frame 60 relative)
// ============================================
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Beat at 5s (relative frame 0): Line 1
  const line1 = snapIn(frame, 0);
  // Beat at 7s (relative frame 60): Lines 2 & 3 together
  const line2 = snapIn(frame, 60);
  const line3 = snapIn(frame, 60);

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
// Beats: 8s (frame 0 relative), 10s (frame 60 relative)
// ============================================
const SellerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat at 8s (relative frame 0): Title
  const titleAnim = snapIn(frame, 0);

  // Beat at 10s (relative frame 60): ALL icons pop together
  const steps = [
    { icon: "📝", text: "List your project" },
    { icon: "✓", text: "Verify GitHub" },
    { icon: "💰", text: "Receive bids" },
    { icon: "🔒", text: "Funds in escrow" },
    { icon: "⚡", text: "Get paid instantly" },
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
            // All icons pop at frame 60 (10s beat)
            const anim = snapIn(frame, 60);
            const popSpring = spring({
              frame: frame - 60,
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
// SCENE 4: For Buyers (12-17s, frames 360-510)
// Beats: 12s (frame 0), 14s (frame 60), 15s (frame 90)
// ============================================
const BuyerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat at 12s (relative frame 0): Title
  const titleAnim = snapIn(frame, 0);

  // Features with beat assignments
  const features = [
    { title: "Skip months of dev", desc: "Buy working products", beatFrame: 60 },
    { title: "Verified sellers", desc: "GitHub ownership proven", beatFrame: 60 },
    { title: "Protected funds", desc: "Blockchain escrow", beatFrame: 90 },
    { title: "Global access", desc: "No borders, no limits", beatFrame: 90 },
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
            const anim = snapIn(frame, feature.beatFrame);
            const popSpring = spring({
              frame: frame - feature.beatFrame,
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
// SCENE 5: Trust/Escrow (17-21s, frames 510-630)
// Beats: 17s (frame 0), 19s (frame 60)
// ============================================
const TrustScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Beat at 17s (relative frame 0): Title
  const titleAnim = snapIn(frame, 0);

  // Beat at 19s (relative frame 60): Entire escrow diagram
  const diagramAnim = snapIn(frame, 60);

  // Escrow pulse
  const escrowPulse = frame > 60 ? 1 + Math.sin((frame - 60) * 0.15) * 0.03 : 1;

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

        {/* Escrow Flow Diagram - all pops at frame 60 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, opacity: diagramAnim.opacity, transform: `scale(${diagramAnim.scale})` }}>
          {/* Seller */}
          <div style={{ textAlign: "center" }}>
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
          <div style={{ display: "flex", alignItems: "center" }}>
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
          <div style={{ textAlign: "center", transform: `scale(${escrowPulse})` }}>
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
          <div style={{ display: "flex", alignItems: "center" }}>
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
          <div style={{ textAlign: "center" }}>
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
// SCENE 6: Stats (21-26s, frames 630-780)
// Beats: 21s (frame 0), 22s (frame 30), 24s (frame 90)
// ============================================
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stats with their beat frames
  const stats = [
    { value: "3-5%", label: "Platform fee", beatFrame: 0 },
    { value: "2s", label: "Settlement", beatFrame: 0 },
    { value: "100%", label: "Trustless escrow", beatFrame: 30 },
    { value: "24/7", label: "Always live", beatFrame: 30 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 100, justifyContent: "center" }}>
        {stats.map((stat, i) => {
          const popSpring = spring({
            frame: frame - stat.beatFrame,
            fps,
            config: { damping: 8, stiffness: 180 },
          });
          const anim = snapIn(frame, stat.beatFrame);

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
// SCENE 7: CTA (26-30s, frames 780-900)
// Beats: 26s (frame 0), 27s (frame 30), 29s (frame 90)
// ============================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat at 26s (frame 0): Logo
  const logoAnim = snapIn(frame, 0);
  const logoSpring = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });

  // Beat at 27s (frame 30): CTA text + URL button
  const ctaAnim = snapIn(frame, 30);
  const urlSpring = spring({ frame: frame - 30, fps, config: { damping: 8, stiffness: 200 } });

  // Beat at 29s (frame 90): Mainnet + more info
  const mainnetAnim = snapIn(frame, 90);

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
            opacity: ctaAnim.opacity,
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
            opacity: mainnetAnim.opacity,
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
// Scene transitions aligned to beat frames
// ============================================
export const AppMarketVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white }}>
      {/* Background Music */}
      <Audio src={staticFile("audio/background.mp3")} volume={1} />

      {/* Scene 1: Title - 0-5s (frames 0-150) | Beats: 0, 2, 3 */}
      <Sequence from={0} durationInFrames={150}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Problem - 5-8s (frames 150-240) | Beats: 5, 7 */}
      <Sequence from={150} durationInFrames={90}>
        <ProblemScene />
      </Sequence>

      {/* Scene 3: Sellers - 8-12s (frames 240-360) | Beats: 8, 10 */}
      <Sequence from={240} durationInFrames={120}>
        <SellerScene />
      </Sequence>

      {/* Scene 4: Buyers - 12-17s (frames 360-510) | Beats: 12, 14, 15 */}
      <Sequence from={360} durationInFrames={150}>
        <BuyerScene />
      </Sequence>

      {/* Scene 5: Trust/Escrow - 17-21s (frames 510-630) | Beats: 17, 19 */}
      <Sequence from={510} durationInFrames={120}>
        <TrustScene />
      </Sequence>

      {/* Scene 6: Stats - 21-26s (frames 630-780) | Beats: 21, 22, 24 */}
      <Sequence from={630} durationInFrames={150}>
        <StatsScene />
      </Sequence>

      {/* Scene 7: CTA - 26-30s (frames 780-900) | Beats: 26, 27, 29 */}
      <Sequence from={780} durationInFrames={120}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
