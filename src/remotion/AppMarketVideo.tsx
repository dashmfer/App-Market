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

// Smooth pop-in animation
const popIn = (frame: number, delay: number, fps: number) => {
  const springValue = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 200 },
  });
  return {
    opacity: interpolate(springValue, [0, 1], [0, 1]),
    scale: interpolate(springValue, [0, 1], [0.8, 1]),
  };
};

// ============================================
// SCENE 1: Title
// ============================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const title = popIn(frame, 0, fps);
  const lineWidth = interpolate(frame, [20, 40], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitle = popIn(frame, 30, fps);

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
// SCENE 2: Problem
// ============================================
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1 = popIn(frame, 0, fps);
  const line2 = popIn(frame, 20, fps);
  const line3 = popIn(frame, 40, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 1200, padding: "0 60px" }}>
        <p style={{ fontSize: 64, color: COLORS.black, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, lineHeight: 1.3, margin: 0, opacity: line1.opacity, transform: `scale(${line1.scale})` }}>
          You built something great.
        </p>
        <p style={{ fontSize: 64, color: COLORS.black, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, lineHeight: 1.3, margin: "20px 0 0 0", opacity: line2.opacity, transform: `scale(${line2.scale})` }}>
          But you don't have time to maintain it.
        </p>
        <p style={{ fontSize: 64, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, lineHeight: 1.3, margin: "20px 0 0 0", opacity: line3.opacity, transform: `scale(${line3.scale})` }}>
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

  const titleAnim = popIn(frame, 0, fps);

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
        <p style={{ fontSize: 28, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          For Sellers
        </p>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: "20px 0 60px 0", opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          Turn side projects into cash
        </h2>
        <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
          {steps.map((step, i) => {
            const anim = popIn(frame, 20 + i * 10, fps);
            return (
              <div key={i} style={{ opacity: anim.opacity, transform: `scale(${anim.scale})`, textAlign: "center" }}>
                <div style={{ width: 100, height: 100, borderRadius: 24, backgroundColor: COLORS.lightGray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 16 }}>
                  {step.icon}
                </div>
                <p style={{ fontSize: 18, color: COLORS.black, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 500, margin: 0, maxWidth: 100 }}>
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

  const titleAnim = popIn(frame, 0, fps);

  const features = [
    { title: "Skip months of dev", desc: "Buy working products" },
    { title: "Verified sellers", desc: "GitHub ownership proven" },
    { title: "Protected funds", desc: "Blockchain escrow" },
    { title: "Global access", desc: "No borders, no limits" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 28, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          For Buyers
        </p>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: "20px 0 60px 0", opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          Find your next project
        </h2>
        <div style={{ display: "flex", gap: 60, justifyContent: "center" }}>
          {features.map((feature, i) => {
            const anim = popIn(frame, 20 + i * 15, fps);
            return (
              <div key={i} style={{ opacity: anim.opacity, transform: `scale(${anim.scale})`, textAlign: "center", maxWidth: 200 }}>
                <h3 style={{ fontSize: 28, color: COLORS.black, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: 0 }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: 20, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 400, margin: "8px 0 0 0" }}>
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
// SCENE 5: Trust/Escrow
// ============================================
const TrustScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleAnim = popIn(frame, 0, fps);
  const diagramAnim = popIn(frame, 20, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: "0 0 20px 0", opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          Trustless by design
        </h2>
        <p style={{ fontSize: 32, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", margin: "0 0 80px 0", opacity: titleAnim.opacity }}>
          Smart contracts hold funds. No middleman.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, opacity: diagramAnim.opacity, transform: `scale(${diagramAnim.scale})` }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", backgroundColor: COLORS.lightGray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 12 }}>👤</div>
            <p style={{ fontSize: 24, color: COLORS.black, fontFamily: "SF Pro Display, sans-serif", fontWeight: 500, margin: 0 }}>Seller</p>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
            <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `16px solid ${COLORS.green}` }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ width: 140, height: 140, borderRadius: 28, background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, marginBottom: 12, boxShadow: `0 20px 60px ${COLORS.green}40` }}>🔒</div>
            <p style={{ fontSize: 24, color: COLORS.green, fontFamily: "SF Pro Display, sans-serif", fontWeight: 600, margin: 0 }}>Escrow</p>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
            <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `16px solid ${COLORS.green}` }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", backgroundColor: COLORS.lightGray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, marginBottom: 12 }}>👤</div>
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

  const stats = [
    { value: "3-5%", label: "Platform fee" },
    { value: "2s", label: "Settlement" },
    { value: "100%", label: "Trustless escrow" },
    { value: "24/7", label: "Always live" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 100, justifyContent: "center" }}>
        {stats.map((stat, i) => {
          const anim = popIn(frame, i * 15, fps);
          return (
            <div key={i} style={{ textAlign: "center", opacity: anim.opacity, transform: `scale(${anim.scale})` }}>
              <p style={{ fontSize: 96, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 700, margin: 0, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ fontSize: 28, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 400, margin: "12px 0 0 0" }}>{stat.label}</p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 7: CTA
// ============================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoAnim = popIn(frame, 0, fps);
  const ctaAnim = popIn(frame, 20, fps);
  const buttonAnim = popIn(frame, 35, fps);
  const mainnetAnim = popIn(frame, 50, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 120, fontWeight: 700, color: COLORS.green, margin: 0, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: "-0.03em", opacity: logoAnim.opacity, transform: `scale(${logoAnim.scale})` }}>
          App Market
        </h1>
        <p style={{ fontSize: 48, color: COLORS.black, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 500, margin: "40px 0", opacity: ctaAnim.opacity, transform: `scale(${ctaAnim.scale})` }}>
          Start building your future.
        </p>
        <div style={{ display: "inline-block", padding: "20px 60px", background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`, borderRadius: 100, opacity: buttonAnim.opacity, transform: `scale(${buttonAnim.scale})`, boxShadow: `0 20px 60px ${COLORS.green}40` }}>
          <p style={{ fontSize: 32, color: COLORS.white, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: 0 }}>appmrkt.xyz</p>
        </div>
        <p style={{ fontSize: 18, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", margin: "40px 0 0 0", opacity: mainnetAnim.opacity, transform: `scale(${mainnetAnim.scale})` }}>
          mainnet prepared
        </p>
        <p style={{ fontSize: 16, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 400, margin: "12px 0 0 0", opacity: mainnetAnim.opacity }}>
          more information soon
        </p>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN VIDEO - 30 seconds, smooth animations
// ============================================
export const AppMarketVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white }}>
      <Audio src={staticFile("audio/background.mp3")} volume={1} />

      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      <Sequence from={120} durationInFrames={120}>
        <ProblemScene />
      </Sequence>

      <Sequence from={240} durationInFrames={120}>
        <SellerScene />
      </Sequence>

      <Sequence from={360} durationInFrames={120}>
        <BuyerScene />
      </Sequence>

      <Sequence from={480} durationInFrames={150}>
        <TrustScene />
      </Sequence>

      <Sequence from={630} durationInFrames={120}>
        <StatsScene />
      </Sequence>

      <Sequence from={750} durationInFrames={150}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
