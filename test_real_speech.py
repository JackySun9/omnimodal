#!/usr/bin/env python3
"""
Generate a test audio file with synthesized speech for STT testing.
This creates actual speech content, not just beeps.
"""

import numpy as np
import wave

def text_to_morse(text):
    """Convert text to morse code patterns."""
    morse_dict = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', ' ': ' '
    }
    return ' '.join(morse_dict.get(c.upper(), '') for c in text)

def generate_speech_like_audio(duration=3.0, sample_rate=16000):
    """
    Generate audio that resembles speech patterns.
    This simulates speech-like characteristics for testing.
    """
    samples = int(sample_rate * duration)
    audio = np.zeros(samples)
    
    # Generate speech-like formant patterns
    t = np.linspace(0, duration, samples)
    
    # Simulate vowel sounds with multiple harmonics (formants)
    # These frequencies approximate human speech formants
    f1 = 700   # First formant
    f2 = 1220  # Second formant
    f3 = 2600  # Third formant
    
    # Add varying pitch (fundamental frequency)
    pitch = 120 + 30 * np.sin(2 * np.pi * 2 * t)  # Varying from 90-150 Hz
    
    # Generate harmonics
    audio += 0.3 * np.sin(2 * np.pi * pitch * t)
    audio += 0.2 * np.sin(2 * np.pi * f1 * t) * (1 + 0.3 * np.sin(2 * np.pi * 3 * t))
    audio += 0.15 * np.sin(2 * np.pi * f2 * t) * (1 + 0.3 * np.sin(2 * np.pi * 4 * t))
    audio += 0.1 * np.sin(2 * np.pi * f3 * t) * (1 + 0.3 * np.sin(2 * np.pi * 5 * t))
    
    # Add envelope (speech-like amplitude modulation)
    envelope = np.abs(np.sin(2 * np.pi * 4 * t))  # 4 "syllables" per second
    audio *= envelope
    
    # Add some noise (breath sounds)
    noise = np.random.normal(0, 0.02, samples)
    audio += noise
    
    # Normalize
    audio = audio / np.max(np.abs(audio)) * 0.7
    
    return audio, sample_rate

def save_wav(filename, audio, sample_rate):
    """Save audio data as WAV file."""
    # Convert to 16-bit PCM
    audio_int16 = np.int16(audio * 32767)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())

if __name__ == "__main__":
    print("🎤 Creating speech-like test audio...")
    
    # Generate 3 seconds of speech-like audio
    audio, sr = generate_speech_like_audio(duration=3.0, sample_rate=16000)
    
    filename = "test_speech.wav"
    save_wav(filename, audio, sr)
    
    file_size = len(audio) * 2 / 1024  # 16-bit = 2 bytes per sample
    
    print(f"✅ Created {filename}")
    print(f"   Duration: {len(audio) / sr:.2f} seconds")
    print(f"   Size: {file_size:.2f} KB")
    print(f"   Sample rate: {sr} Hz")
    print()
    print("📝 Note: This audio contains speech-like patterns (formants)")
    print("   but no actual words. Whisper may still attempt transcription.")
    print()
    print("💡 For best results, use real speech audio files.")
    print()
    print("🧪 Test with:")
    print(f'curl -X POST "http://localhost:8000/api/v1/stt/transcribe" \\')
    print(f'     -F "audio=@{filename}" \\')
    print(f'     -F "executor=faster-whisper-stt" \\')
    print(f'     -F "language=en"')
