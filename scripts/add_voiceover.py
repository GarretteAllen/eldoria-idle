import subprocess
import os

FFMPEG = "/usr/lib/jellyfin-ffmpeg/ffmpeg"
EDGE_TTS = "/home/gar/.local/bin/edge-tts"
VOICE = "en-US-BrianMultilingualNeural"  # Approachable, casual, natural social media creator voice

# Synced audio clips matching video sections:
# 0.0s - 4.5s: Mining
# 4.5s - 9.0s: Queueing
# 9.0s - 13.0s: Inventory / Vault
# 13.0s - 17.5s: Marketplace
CLIPS = [
    {
        "file": "records/voice_1.mp3",
        "text": "First, pick your node and start training your skills.",
        "delay_ms": 300,
    },
    {
        "file": "records/voice_2.mp3",
        "text": "Queue up another job, and it automatically starts when your mining finishes.",
        "delay_ms": 4700,
    },
    {
        "file": "records/voice_3.mp3",
        "text": "All your gathered loot goes straight into your satchel and vault.",
        "delay_ms": 9300,
    },
    {
        "file": "records/voice_4.mp3",
        "text": "Then flip your resources on the live player market. Play free right in your browser!",
        "delay_ms": 13300,
    }
]

print("[Voiceover] Generating speech clips with Edge TTS...")
for c in CLIPS:
    cmd = [EDGE_TTS, "--voice", VOICE, "--rate=+5%", "--text", c["text"], "--write-media", c["file"]]
    subprocess.run(cmd, check=True)
    print(f"  Generated {c['file']}: '{c['text']}'")

# Merge audio clips into a single track with precise adelay timestamps
# We construct a filter_complex graph to position each clip exactly at its timestamp
filter_parts = []
inputs = []
for i, c in enumerate(CLIPS):
    inputs.extend(["-i", c["file"]])
    filter_parts.append(f"[{i}]adelay={c['delay_ms']}|{c['delay_ms']}[a{i}]")

mix_inputs = "".join(f"[a{i}]" for i in range(len(CLIPS)))
filter_graph = f"{';'.join(filter_parts)};{mix_inputs}amix=inputs={len(CLIPS)}:normalize=0[voice];[voice]volume=1.35[outa]"

mixed_audio = "records/full_voiceover.mp3"
mix_cmd = [
    FFMPEG, "-y",
    *inputs,
    "-filter_complex", filter_graph,
    "-map", "[outa]",
    mixed_audio
]

print("[Voiceover] Mixing timed voiceover track...")
subprocess.run(mix_cmd, check=True)

# Combine mixed audio with our edited video
final_video = "records/eldoria_promo_with_voiceover.mp4"
combine_cmd = [
    FFMPEG, "-y",
    "-i", "records/eldoria_promo_edited.mp4",
    "-i", mixed_audio,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    final_video
]

print(f"[Voiceover] Muxing audio into final video: {final_video}...")
subprocess.run(combine_cmd, check=True)
print(f"[Voiceover] Done! Finished video: {final_video}")
