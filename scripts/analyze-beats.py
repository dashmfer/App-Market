#!/usr/bin/env python3
"""
Beat detection script for syncing Remotion video transitions to music.
Run: pip install librosa numpy && python scripts/analyze-beats.py
"""
import sys
try:
    import librosa
    import numpy as np
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "librosa", "numpy"])
    import librosa
    import numpy as np

# Audio file path
audio_path = "public/audio/background.mp3"

print(f"Analyzing: {audio_path}")
print("Loading audio (this may take a moment)...")

# Load the audio file
y, sr = librosa.load(audio_path)

# Get tempo and beat frames
tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

# Handle tempo as array (newer librosa versions)
if hasattr(tempo, '__len__'):
    tempo = float(tempo[0]) if len(tempo) > 0 else float(tempo)
else:
    tempo = float(tempo)

# Convert beat frames to timestamps (in seconds)
beat_times = librosa.frames_to_time(beat_frames, sr=sr)

# Get duration
duration = librosa.get_duration(y=y, sr=sr)

print(f"\n{'='*50}")
print(f"Audio Duration: {duration:.2f} seconds")
print(f"Estimated Tempo: {tempo:.1f} BPM")
print(f"Number of beats detected: {len(beat_times)}")
print(f"{'='*50}")

print("\n--- All Beat Timestamps ---")
print("(seconds -> frame at 30fps)")
for i, t in enumerate(beat_times):
    frame = int(t * 30)
    print(f"  Beat {i+1:3d}: {t:6.2f}s -> frame {frame:4d}")

# Suggest scene transitions every 4 beats (typical music phrase)
print(f"\n{'='*50}")
print("SUGGESTED SCENE TRANSITIONS (every 4 beats):")
print("Copy these frame numbers to your Remotion sequences:")
print(f"{'='*50}")

transitions = []
for i in range(0, len(beat_times), 4):
    if i < len(beat_times):
        t = beat_times[i]
        frame = int(t * 30)
        transitions.append((frame, t))
        print(f"  Scene {len(transitions)}: frame {frame:4d} ({t:5.2f}s)")

# Generate Remotion-ready code snippet
print(f"\n{'='*50}")
print("REMOTION CODE SNIPPET:")
print("(Copy this to AppMarketVideo.tsx)")
print(f"{'='*50}\n")

scene_names = ["TitleScene", "ProblemScene", "SellerScene", "BuyerScene", "TrustScene", "StatsScene", "CTAScene"]

print("// Scene timings synced to music beats")
for i, (frame, time) in enumerate(transitions[:len(scene_names)]):
    if i < len(transitions) - 1:
        next_frame = transitions[i + 1][0]
        duration = next_frame - frame
    else:
        duration = int(duration * 30) - frame  # Until end of audio

    if i < len(scene_names):
        print(f'<Sequence from={{{frame}}} durationInFrames={{{duration}}}>')
        print(f'  <{scene_names[i]} />')
        print(f'</Sequence>')

print(f"\n// Total video duration: {int(duration * 30)} frames ({duration:.1f}s)")
