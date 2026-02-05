import {
  AbsoluteFill,
  useCurrentFrame,
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
// USER'S DESIRED POP TIMES (seconds):
// 0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 21, 22, 24, 26, 27, 29
// ============================================

// INSTANT pop-in animation - hits exactly on the beat frame
const snapIn = (frame: number, startFrame: number) => {
  // Instant appearance on the exact frame
  const opacity = frame >= startFrame ? 1 : 0;
  const scale = frame >= startFrame ? 1 : 0.5;
  return { opacity, scale };
};

// ============================================
// SCENE 1: Title (0-4s, frames 0-120)
// Pops at: 0s (frame 0), 2s (frame 60), 3s (frame 90)
// ============================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 0s (frame 0): Title
  const title = snapIn(frame, 0);

  // Pop at 2s (frame 60): Line - instant
  const lineWidth = frame >= 60 ? 200 : 0;

  // Pop at 3s (frame 90): Subtitle
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
            transform: `scale(${title.scale})`,
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
// Scene starts at 4s. Pops at: 5s (frame 30), 7s (frame 90)
// ============================================
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 5s (frame 30 relative - scene starts at 4s): Line 1
  const line1 = snapIn(frame, 30);
  // Pop at 7s (frame 90 relative): Lines 2 & 3
  const line2 = snapIn(frame, 90);
  const line3 = snapIn(frame, 90);

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
// Scene starts at 8s. Pops at: 8s (frame 0), 10s (frame 60)
// ============================================
const SellerScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 8s (frame 0): Title
  const titleAnim = snapIn(frame, 0);

  // Pop at 10s (frame 60): ALL icons - instant
  const iconsAnim = snapIn(frame, 60);

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
            return (
              <div
                key={i}
                style={{
                  opacity: iconsAnim.opacity,
                  transform: `scale(${iconsAnim.scale})`,
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
// Scene starts at 12s. Pops at: 12s (frame 0), 14s (frame 60), 15s (frame 90)
// ============================================
const BuyerScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 12s (frame 0): Title
  const titleAnim = snapIn(frame, 0);

  // Pop at 14s (frame 60): Features 1 & 2
  const features12 = snapIn(frame, 60);
  // Pop at 15s (frame 90): Features 3 & 4
  const features34 = snapIn(frame, 90);

  const features = [
    { title: "Skip months of dev", desc: "Buy working products", anim: features12 },
    { title: "Verified sellers", desc: "GitHub ownership proven", anim: features12 },
    { title: "Protected funds", desc: "Blockchain escrow", anim: features34 },
    { title: "Global access", desc: "No borders, no limits", anim: features34 },
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
            return (
              <div
                key={i}
                style={{
                  opacity: feature.anim.opacity,
                  transform: `scale(${feature.anim.scale})`,
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
// Scene starts at 16s. Pops at: 17s (frame 30), 19s (frame 90)
// ============================================
const TrustScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 17s (frame 30 - scene starts at 16s): Title
  const titleAnim = snapIn(frame, 30);

  // Pop at 19s (frame 90): Entire escrow diagram
  const diagramAnim = snapIn(frame, 90);

  // Escrow pulse
  const escrowPulse = frame > 90 ? 1 + Math.sin((frame - 90) * 0.15) * 0.03 : 1;

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
// SCENE 6: Stats (21-25s, frames 630-750)
// Scene starts at 21s. Pops at: 21s (frame 0), 22s (frame 30), 24s (frame 90)
// ============================================
const StatsScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 21s (frame 0): Stats 1 & 2
  const stats12 = snapIn(frame, 0);
  // Pop at 22s (frame 30): Stat 3
  const stat3 = snapIn(frame, 30);
  // Pop at 24s (frame 90): Stat 4
  const stat4 = snapIn(frame, 90);

  const stats = [
    { value: "3-5%", label: "Platform fee", anim: stats12 },
    { value: "2s", label: "Settlement", anim: stats12 },
    { value: "100%", label: "Trustless escrow", anim: stat3 },
    { value: "24/7", label: "Always live", anim: stat4 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 100, justifyContent: "center" }}>
        {stats.map((stat, i) => {
          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity: stat.anim.opacity,
                transform: `scale(${stat.anim.scale})`,
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
// Scene starts at 25s. Pops at: 26s (frame 30), 27s (frame 60), 29s (frame 120)
// ============================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Pop at 26s (frame 30 - scene starts at 25s): Logo
  const logoAnim = snapIn(frame, 30);

  // Pop at 27s (frame 60): CTA text + URL button
  const ctaAnim = snapIn(frame, 60);

  // Pop at 29s (frame 120): Mainnet + more info
  const mainnetAnim = snapIn(frame, 120);

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
            transform: `scale(${logoAnim.scale})`,
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
            transform: `scale(${ctaAnim.scale})`,
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
// Original scene structure restored
// ============================================
export const AppMarketVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white }}>
      {/* Background Music */}
      <Audio src={staticFile("audio/background.mp3")} volume={1} />

      {/* Scene 1: Title - 0-4s | Pops at 0, 2, 3 */}
      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Problem - 4-8s | Pops at 5, 7 */}
      <Sequence from={120} durationInFrames={120}>
        <ProblemScene />
      </Sequence>

      {/* Scene 3: Sellers - 8-12s | Pops at 8, 10 */}
      <Sequence from={240} durationInFrames={120}>
        <SellerScene />
      </Sequence>

      {/* Scene 4: Buyers - 12-16s | Pops at 12, 14, 15 */}
      <Sequence from={360} durationInFrames={120}>
        <BuyerScene />
      </Sequence>

      {/* Scene 5: Trust/Escrow - 16-21s | Pops at 17, 19 */}
      <Sequence from={480} durationInFrames={150}>
        <TrustScene />
      </Sequence>

      {/* Scene 6: Stats - 21-25s | Pops at 21, 22, 24 */}
      <Sequence from={630} durationInFrames={120}>
        <StatsScene />
      </Sequence>

      {/* Scene 7: CTA - 25-30s | Pops at 26, 27, 29 */}
      <Sequence from={750} durationInFrames={150}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
