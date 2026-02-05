import {
  AbsoluteFill,
  useCurrentFrame,
  Sequence,
  Audio,
  staticFile,
} from "remotion";
import React from "react";

// Simple beat marker - flashes on each beat
const BeatMarker: React.FC = () => {
  const frame = useCurrentFrame();

  // Flash every 30 frames (1 second intervals)
  const beatInterval = 30;
  const isOnBeat = frame % beatInterval < 5;

  // Current time display
  const seconds = (frame / 30).toFixed(1);
  const beatNumber = Math.floor(frame / beatInterval);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isOnBeat ? "#22c55e" : "#000000",
        justifyContent: "center",
        alignItems: "center",
        transition: "background-color 0.05s",
      }}
    >
      <div style={{ textAlign: "center", color: "#ffffff" }}>
        <p style={{ fontSize: 200, fontWeight: 700, margin: 0 }}>
          {beatNumber}
        </p>
        <p style={{ fontSize: 48, margin: "20px 0 0 0" }}>
          {seconds}s
        </p>
        <p style={{ fontSize: 24, marginTop: 40, opacity: 0.7 }}>
          Beat every 1 second (30 frames)
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const BeatTestVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Audio src={staticFile("audio/background.mp3")} volume={1} />
      <Sequence from={0} durationInFrames={900}>
        <BeatMarker />
      </Sequence>
    </AbsoluteFill>
  );
};
