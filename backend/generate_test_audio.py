#!/usr/bin/env python3
"""
Generate a test audio file for STT testing.

This script creates a simple WAV file with synthesized speech
so you can test the STT integration without needing real audio.
"""

import wave
import array
import math


def generate_beep(frequency=440, duration=0.5, sample_rate=16000):
    """Generate a beep tone."""
    num_samples = int(sample_rate * duration)
    samples = []
    
    for i in range(num_samples):
        # Generate sine wave
        sample = math.sin(2 * math.pi * frequency * i / sample_rate)
        # Convert to 16-bit integer
        sample = int(sample * 32767)
        samples.append(sample)
    
    return samples


def generate_silence(duration=0.5, sample_rate=16000):
    """Generate silence."""
    num_samples = int(sample_rate * duration)
    return [0] * num_samples


def create_test_audio(output_file="test_audio.wav"):
    """Create a test audio file."""
    print(f"🎵 Creating test audio file: {output_file}")
    
    sample_rate = 16000  # 16 kHz (good for speech)
    
    # Create a sequence of beeps (like morse code)
    audio_samples = []
    
    # Pattern: short-short-long (like "SOS" in morse)
    audio_samples.extend(generate_beep(440, 0.2, sample_rate))  # Short beep
    audio_samples.extend(generate_silence(0.2, sample_rate))
    audio_samples.extend(generate_beep(440, 0.2, sample_rate))  # Short beep
    audio_samples.extend(generate_silence(0.2, sample_rate))
    audio_samples.extend(generate_beep(440, 0.6, sample_rate))  # Long beep
    audio_samples.extend(generate_silence(0.5, sample_rate))
    
    # Write to WAV file
    with wave.open(output_file, 'w') as wav_file:
        # Set parameters (1 channel, 2 bytes per sample, sample rate)
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        # Convert to bytes and write
        audio_data = array.array('h', audio_samples)
        wav_file.writeframes(audio_data.tobytes())
    
    duration = len(audio_samples) / sample_rate
    size = len(audio_samples) * 2 / 1024  # KB
    
    print(f"✅ Created {output_file}")
    print(f"   Duration: {duration:.2f} seconds")
    print(f"   Size: {size:.2f} KB")
    print(f"   Sample rate: {sample_rate} Hz")
    print()
    print("Note: This is a synthetic beep pattern, not actual speech.")
    print("For real testing, please use actual audio files with speech.")
    print()
    print("💡 To test with this file:")
    print()
    print('curl -X POST "http://localhost:8000/api/v1/stt/transcribe" \\')
    print('     -F "audio=@test_audio.wav" \\')
    print('     -F "executor=faster-whisper-stt"')
    print()


def main():
    """Main function."""
    import sys
    
    output_file = sys.argv[1] if len(sys.argv) > 1 else "test_audio.wav"
    
    try:
        create_test_audio(output_file)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
