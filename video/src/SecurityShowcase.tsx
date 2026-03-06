import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { colors, fonts } from "./styles";
import { GlowText } from "./components/GlowText";
import { CodeBlock } from "./components/CodeBlock";
import { AnimatedCounter } from "./components/AnimatedCounter";
import { ScannerOverlay } from "./components/ScannerOverlay";
import { CommitTimeline } from "./components/CommitTimeline";
import { ProgressBar } from "./components/ProgressBar";
import { BadgeRow } from "./components/BadgeRow";

// ─── Scene: Intro ──────────────────────────────────────────────
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgPulse = interpolate(Math.sin(frame * 0.03), [-1, 1], [0.03, 0.08]);

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background gradient orbs */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}${Math.round(bgPulse * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          top: "10%",
          right: "10%",
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.secondary}${Math.round(bgPulse * 200).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          bottom: "10%",
          left: "15%",
          filter: "blur(80px)",
        }}
      />

      <ScannerOverlay speed={0.008} />

      {/* Solana logo placeholder */}
      <div
        style={{
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
          marginBottom: 30,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${colors.solana}, ${colors.solanaTeal})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: 900,
            color: "#fff",
            fontFamily: fonts.heading,
            boxShadow: `0 0 40px ${colors.solana}44`,
          }}
        >
          S
        </div>
      </div>

      <GlowText text="APP MARKET" fontSize={96} delay={5} />
      <div style={{ height: 16 }} />
      <GlowText
        text="Security Hardening Journey"
        fontSize={36}
        delay={15}
        color={colors.textMuted}
        glowColor={colors.secondary}
      />

      <div
        style={{
          marginTop: 50,
          opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <BadgeRow
          badges={[
            { label: "Solana", icon: "\u26A1", color: colors.solana },
            { label: "Escrow", icon: "\uD83D\uDD12", color: colors.accent },
            { label: "Marketplace", icon: "\uD83C\uDFEA", color: colors.primary },
          ]}
          delay={30}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: The Problem ────────────────────────────────────────
const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <ScannerOverlay delay={0} speed={0.03} />

      <GlowText
        text="Smart Contracts Handle Real Money"
        fontSize={56}
        delay={0}
        glowColor={colors.danger}
        color={colors.danger}
      />

      <div style={{ height: 40 }} />

      <GlowText
        text="One vulnerability = total loss of funds"
        fontSize={32}
        delay={12}
        color={colors.textMuted}
        glowColor={colors.danger}
      />

      <div style={{ height: 60 }} />

      <div
        style={{
          display: "flex",
          gap: 40,
          opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {[
          { label: "Reentrancy", icon: "\uD83D\uDD04" },
          { label: "Overflow", icon: "\uD83D\uDCA5" },
          { label: "Access Control", icon: "\uD83D\uDEAB" },
          { label: "Front-Running", icon: "\uD83C\uDFC3" },
        ].map((threat, i) => {
          const delay = 25 + i * 5;
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
            extrapolateRight: "clamp",
          });
          const scale = interpolate(frame, [delay, delay + 6, delay + 12], [0.8, 1.05, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "28px 32px",
                background: `${colors.danger}10`,
                border: `1px solid ${colors.danger}33`,
                borderRadius: 16,
                opacity,
                transform: `scale(${scale})`,
              }}
            >
              <span style={{ fontSize: 44 }}>{threat.icon}</span>
              <span
                style={{
                  fontFamily: fonts.body,
                  fontSize: 18,
                  color: colors.danger,
                  fontWeight: 600,
                }}
              >
                {threat.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: The Audit ──────────────────────────────────────────
const AuditScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <GlowText text="Professional Security Audit" fontSize={52} delay={0} />
      <div style={{ height: 20 }} />
      <GlowText
        text="Trail of Bits + Automated Scanning"
        fontSize={28}
        delay={10}
        color={colors.textMuted}
        glowColor={colors.secondary}
      />
      <div style={{ height: 50 }} />

      <BadgeRow
        badges={[
          { label: "CodeQL", icon: "\uD83D\uDD0D", color: colors.primary },
          { label: "Trivy", icon: "\uD83D\uDEE1\uFE0F", color: colors.accent },
          { label: "Snyk", icon: "\uD83D\uDD10", color: colors.secondary },
          { label: "Semgrep", icon: "\u2699\uFE0F", color: colors.warning },
        ]}
        delay={15}
      />

      <div style={{ height: 50 }} />

      <div
        style={{
          opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" }),
          width: "100%",
          maxWidth: 700,
        }}
      >
        <CodeBlock
          title="security-scan.yml"
          delay={35}
          typingSpeed={3}
          lines={[
            { text: "name: Security Analysis Pipeline", color: colors.accent },
            { text: "on: [push, pull_request, schedule]", color: colors.textMuted },
            { text: "" },
            { text: "jobs:", color: colors.primary },
            { text: "  codeql:", indent: 0, color: "#a9b1d6" },
            { text: "    uses: github/codeql-action/analyze@v3", indent: 1, color: colors.textMuted },
            { text: "  trivy:", indent: 0, color: "#a9b1d6" },
            { text: "    severity: CRITICAL,HIGH,MEDIUM", indent: 1, color: colors.warning },
            { text: "  snyk:", indent: 0, color: "#a9b1d6" },
            { text: "    command: code test", indent: 1, color: colors.textMuted },
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: The Fixes ──────────────────────────────────────────
const FixesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const commits = [
    { hash: "548f83a", message: "Remediate all 79 Semgrep findings", type: "fix" as const },
    { hash: "d847646", message: "Remediate CodeQL and Trivy findings", type: "fix" as const },
    { hash: "e91b8c7", message: "Add CodeQL, Trivy, Snyk scanning", type: "ci" as const },
    { hash: "c220934", message: "Comprehensive security fixes for all scans", type: "fix" as const },
    { hash: "32c1fa4", message: "Remediate Semgrep static analysis", type: "fix" as const },
    { hash: "7cff82f", message: "Secure cron route debug output", type: "fix" as const },
    { hash: "4441cb7", message: "Remove debug console.log from client", type: "fix" as const },
    { hash: "0b2aefd", message: "Runtime Solana env var validation", type: "fix" as const },
    { hash: "8323781", message: "Resolve build errors from security fixes", type: "fix" as const },
    { hash: "c9633c4", message: "Trail of Bits semgrep final results", type: "docs" as const },
  ];

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 100px",
      }}
    >
      <GlowText text="Commit by Commit" fontSize={52} delay={0} />
      <div style={{ height: 8 }} />
      <GlowText
        text="Every fix tracked, every vulnerability patched"
        fontSize={24}
        delay={8}
        color={colors.textMuted}
      />
      <div style={{ height: 40 }} />

      <div
        style={{
          width: "100%",
          maxWidth: 950,
          opacity: interpolate(frame, [12, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <CommitTimeline commits={commits} delay={15} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: The Tests ──────────────────────────────────────────
const TestsScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        gap: 60,
      }}
    >
      {/* Left: test output */}
      <div style={{ flex: 1 }}>
        <CodeBlock
          title="ts-mocha tests/app-market.ts"
          delay={5}
          typingSpeed={2}
          lines={[
            { text: "  App Market", color: colors.text },
            { text: "    Initialization", color: colors.textMuted },
            {
              text: "      \u2713 should initialize config",
              color: colors.accent,
              indent: 0,
            },
            { text: "    Security Validations", color: colors.textMuted },
            {
              text: "      \u2713 anti-snipe window enforced",
              color: colors.accent,
              indent: 0,
            },
            {
              text: "      \u2713 rate limiting active",
              color: colors.accent,
              indent: 0,
            },
            {
              text: "      \u2713 admin timelock: 48h",
              color: colors.accent,
              indent: 0,
            },
            {
              text: "      \u2713 fee bounds validated",
              color: colors.accent,
              indent: 0,
            },
            {
              text: "      \u2713 DoS protection active",
              color: colors.accent,
              indent: 0,
            },
            { text: "    Math Overflow Protection", color: colors.textMuted },
            {
              text: "      \u2713 safe arithmetic verified",
              color: colors.accent,
              indent: 0,
            },
            { text: "" },
            {
              text: "  25 passing (12s)",
              color: colors.accent,
            },
            {
              text: "  0 failing",
              color: colors.accent,
            },
          ]}
        />
      </div>

      {/* Right: stats */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          opacity: interpolate(frame, [30, 45], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <AnimatedCounter value={25} label="Instructions" delay={35} color={colors.primary} />
        <AnimatedCounter value={2} label="Test Suites" delay={40} color={colors.secondary} />
        <AnimatedCounter value={0} label="Failures" delay={45} color={colors.accent} suffix="" />
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: Integration Tests ──────────────────────────────────
const IntegrationScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <GlowText text="Integration Tests" fontSize={52} delay={0} />
      <div style={{ height: 8 }} />
      <GlowText
        text="Live devnet contract verification"
        fontSize={26}
        delay={8}
        color={colors.textMuted}
      />
      <div style={{ height: 50 }} />

      <CodeBlock
        title="ts-mocha tests/integration.ts"
        delay={12}
        typingSpeed={2}
        lines={[
          { text: "  Integration Tests (Devnet)", color: colors.text },
          { text: "    Config", color: colors.textMuted },
          { text: "      \u2713 config account verified", color: colors.accent },
          { text: "    Pause Mechanism", color: colors.textMuted },
          { text: "      \u2713 pause/unpause works", color: colors.accent },
          { text: "    Listing Flow", color: colors.textMuted },
          { text: "      \u2713 create, bid, buy_now", color: colors.accent },
          { text: "    Dispute Resolution", color: colors.textMuted },
          { text: "      \u2713 raise, vote, resolve", color: colors.accent },
          { text: "    Emergency Refund", color: colors.textMuted },
          { text: "      \u2713 refund mechanism works", color: colors.accent },
          { text: "    Instruction Discriminators", color: colors.textMuted },
          { text: "      \u2713 all 25 instructions valid", color: colors.accent },
        ]}
      />
    </AbsoluteFill>
  );
};

// ─── Scene: Results Dashboard ──────────────────────────────────
const ResultsScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 120px",
      }}
    >
      <GlowText text="The Results" fontSize={56} delay={0} />
      <div style={{ height: 50 }} />

      {/* Counters row */}
      <div style={{ display: "flex", gap: 80, marginBottom: 60 }}>
        <AnimatedCounter value={79} label="Semgrep Fixes" delay={10} color={colors.accent} />
        <AnimatedCounter value={3} label="CI Pipelines" delay={16} color={colors.primary} />
        <AnimatedCounter value={25} label="Instructions" delay={22} color={colors.secondary} />
        <AnimatedCounter value={0} label="Critical Issues" delay={28} color={colors.danger} />
      </div>

      {/* Progress bars */}
      <div style={{ width: "100%", maxWidth: 800 }}>
        <ProgressBar label="Semgrep Findings Resolved" value={79} maxValue={79} delay={35} color={colors.accent} />
        <ProgressBar label="CodeQL Issues Fixed" value={12} maxValue={12} delay={40} color={colors.primary} />
        <ProgressBar label="Trivy Vulnerabilities Patched" value={8} maxValue={8} delay={45} color={colors.secondary} />
        <ProgressBar label="Smart Contract Coverage" value={25} maxValue={25} delay={50} color={colors.solanaTeal} />
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: interpolate(frame, [65, 75], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <BadgeRow
          badges={[
            { label: "All Passing", icon: "\u2705", color: colors.accent },
            { label: "Zero Critical", icon: "\uD83D\uDEE1\uFE0F", color: colors.primary },
            { label: "Audit Complete", icon: "\uD83C\uDFC6", color: colors.warning },
          ]}
          delay={70}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: Outro ──────────────────────────────────────────────
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgPulse = interpolate(Math.sin(frame * 0.04), [-1, 1], [0.04, 0.1]);

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.accent}${Math.round(bgPulse * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          filter: "blur(100px)",
        }}
      />

      <GlowText text="APP MARKET" fontSize={80} delay={0} glowColor={colors.accent} />
      <div style={{ height: 20 }} />
      <GlowText
        text="Battle-Tested. Audit-Proven. Production-Ready."
        fontSize={30}
        delay={12}
        color={colors.textMuted}
        glowColor={colors.accent}
      />
      <div style={{ height: 60 }} />

      <div
        style={{
          opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
          display: "flex",
          gap: 24,
        }}
      >
        <div
          style={{
            padding: "18px 40px",
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            borderRadius: 14,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: fonts.heading,
            color: "#fff",
            boxShadow: `0 0 40px ${colors.primary}44`,
          }}
        >
          Trustless Escrow on Solana
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          opacity: interpolate(frame, [40, 55], [0, 0.5], { extrapolateRight: "clamp" }),
          fontFamily: fonts.mono,
          fontSize: 16,
          color: colors.textMuted,
        }}
      >
        github.com/dashmfer/App-Market
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ──────────────────────────────────────────
export const SecurityShowcase: React.FC = () => {
  // Scene timing (in frames at 30fps)
  // Total: 60 seconds = 1800 frames
  const SCENE_INTRO = 0;           // 0-7s (210 frames)
  const SCENE_PROBLEM = 210;       // 7-14s
  const SCENE_AUDIT = 420;         // 14-22s (240 frames)
  const SCENE_FIXES = 660;         // 22-32s (300 frames)
  const SCENE_TESTS = 960;         // 32-40s (240 frames)
  const SCENE_INTEGRATION = 1200;  // 40-47s (210 frames)
  const SCENE_RESULTS = 1410;      // 47-54s (210 frames)
  const SCENE_OUTRO = 1620;        // 54-60s (180 frames)

  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <Sequence from={SCENE_INTRO} durationInFrames={210}>
        <IntroScene />
      </Sequence>

      <Sequence from={SCENE_PROBLEM} durationInFrames={210}>
        <ProblemScene />
      </Sequence>

      <Sequence from={SCENE_AUDIT} durationInFrames={240}>
        <AuditScene />
      </Sequence>

      <Sequence from={SCENE_FIXES} durationInFrames={300}>
        <FixesScene />
      </Sequence>

      <Sequence from={SCENE_TESTS} durationInFrames={240}>
        <TestsScene />
      </Sequence>

      <Sequence from={SCENE_INTEGRATION} durationInFrames={210}>
        <IntegrationScene />
      </Sequence>

      <Sequence from={SCENE_RESULTS} durationInFrames={210}>
        <ResultsScene />
      </Sequence>

      <Sequence from={SCENE_OUTRO} durationInFrames={180}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
