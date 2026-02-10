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

// Outline Icons (green stroke, no fill)
const IconDocument: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconCheck: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11.5 14.5 16 9" />
  </svg>
);

const IconMoney: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v12" />
    <path d="M15 9.5c0-1.5-1.5-2.5-3-2.5s-3 1-3 2.5 1.5 2 3 2.5 3 1 3 2.5-1.5 2.5-3 2.5-3-1-3-2.5" />
  </svg>
);

const IconLock: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <circle cx="12" cy="16" r="1" />
  </svg>
);

const IconBolt: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconPerson: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
  </svg>
);

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
          Where Software Changes Hands
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
          Every great product
        </p>
        <p style={{ fontSize: 64, color: COLORS.black, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, lineHeight: 1.3, margin: "20px 0 0 0", opacity: line2.opacity, transform: `scale(${line2.scale})` }}>
          deserves its next chapter.
        </p>
        <p style={{ fontSize: 64, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, lineHeight: 1.3, margin: "20px 0 0 0", opacity: line3.opacity, transform: `scale(${line3.scale})` }}>
          We make that possible.
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
    { icon: <IconDocument size={48} />, text: "List Your Product" },
    { icon: <IconCheck size={48} />, text: "Verify Ownership" },
    { icon: <IconMoney size={48} />, text: "Receive Offers" },
    { icon: <IconLock size={48} />, text: "Secure Escrow" },
    { icon: <IconBolt size={48} />, text: "Instant Settlement" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 28, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          For Sellers
        </p>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: "20px 0 60px 0", opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          Realize the Value You've Created
        </h2>
        <div style={{ display: "flex", gap: 40, justifyContent: "center" }}>
          {steps.map((step, i) => {
            const anim = popIn(frame, 20 + i * 10, fps);
            return (
              <div key={i} style={{ opacity: anim.opacity, transform: `scale(${anim.scale})`, textAlign: "center" }}>
                <div style={{ width: 100, height: 100, borderRadius: 24, backgroundColor: COLORS.white, border: `2px solid ${COLORS.lightGray}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
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
    { title: "Skip Months of R&D", desc: "Acquire production-ready products" },
    { title: "Verified Ownership", desc: "Authenticated via GitHub" },
    { title: "Secure Transactions", desc: "Protected by smart contracts" },
    { title: "Borderless Access", desc: "Available worldwide" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 28, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          For Buyers
        </p>
        <h2 style={{ fontSize: 72, color: COLORS.green, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: "20px 0 60px 0", opacity: titleAnim.opacity, transform: `scale(${titleAnim.scale})` }}>
          Acquire. Launch. Lead.
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
            <div style={{ width: 120, height: 120, borderRadius: "50%", backgroundColor: COLORS.white, border: `2px solid ${COLORS.lightGray}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <IconPerson size={56} />
            </div>
            <p style={{ fontSize: 24, color: COLORS.black, fontFamily: "SF Pro Display, sans-serif", fontWeight: 500, margin: 0 }}>Buyer</p>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
            <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `16px solid ${COLORS.green}` }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ width: 140, height: 140, borderRadius: 28, backgroundColor: COLORS.white, border: `3px solid ${COLORS.green}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: `0 20px 60px ${COLORS.green}20` }}>
              <IconLock size={64} />
            </div>
            <p style={{ fontSize: 24, color: COLORS.green, fontFamily: "SF Pro Display, sans-serif", fontWeight: 600, margin: 0 }}>Escrow</p>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 80, height: 4, backgroundColor: COLORS.green, borderRadius: 2 }} />
            <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: `16px solid ${COLORS.green}` }} />
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", backgroundColor: COLORS.white, border: `2px solid ${COLORS.lightGray}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <IconPerson size={56} />
            </div>
            <p style={{ fontSize: 24, color: COLORS.black, fontFamily: "SF Pro Display, sans-serif", fontWeight: 500, margin: 0 }}>Seller</p>
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
    { value: "3-5%", label: "Platform Fee" },
    { value: "2s", label: "Settlement Time" },
    { value: "100%", label: "Non-Custodial" },
    { value: "24/7", label: "Always Available" },
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
  const buttonAnim = popIn(frame, 20, fps);
  const mainnetAnim = popIn(frame, 35, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 120, fontWeight: 700, color: COLORS.green, margin: 0, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: "-0.03em", opacity: logoAnim.opacity, transform: `scale(${logoAnim.scale})` }}>
          App Market
        </h1>
        <div style={{ display: "inline-block", padding: "20px 60px", background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.emerald})`, borderRadius: 100, marginTop: 40, opacity: buttonAnim.opacity, transform: `scale(${buttonAnim.scale})`, boxShadow: `0 20px 60px ${COLORS.green}40` }}>
          <p style={{ fontSize: 32, color: COLORS.white, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 600, margin: 0 }}>appmrkt.xyz</p>
        </div>
        <p style={{ fontSize: 18, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", margin: "40px 0 0 0", opacity: mainnetAnim.opacity, transform: `scale(${mainnetAnim.scale})` }}>
          mainnet prepared
        </p>
        <p style={{ fontSize: 16, color: COLORS.gray, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: 400, margin: "12px 0 0 0", opacity: mainnetAnim.opacity }}>
          More Information Soon
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
