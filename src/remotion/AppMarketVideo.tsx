import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";

export const AppMarketVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animate title entrance
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleY = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  const titleTransform = interpolate(titleY, [0, 1], [50, 0]);

  // Animate subtitle
  const subtitleOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleTransform}px)`,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: 120,
            fontWeight: "bold",
            color: "white",
            margin: 0,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          App Market
        </h1>
        <p
          style={{
            fontSize: 40,
            color: "#888",
            marginTop: 20,
            opacity: subtitleOpacity,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Buy & Sell Apps Securely on Solana
        </p>
      </div>
    </AbsoluteFill>
  );
};
