# Audio Format Guide for Steganography System

## Why WAV Only?

This steganography system uses **LSB (Least Significant Bit)** steganography, which requires **uncompressed audio data**. 

- ✅ **WAV (PCM uncompressed)** - Works perfectly
- ❌ **MP3** - Does NOT work (compressed format)
- ❌ **AAC/M4A** - Does NOT work (compressed format)
- ❌ **FLAC** - Does NOT work (lossless compression)
- ❌ **OGG** - Does NOT work (compressed format)

**Why MP3 doesn't work:** MP3 uses lossy compression that removes audio data. Modifying the bits in an MP3 file corrupts the audio because the compression algorithm expects specific bit patterns. The resulting audio would be unplayable or severely degraded.

## Converting MP3 to WAV

### Method 1: Using the Built-in Converter Script (Recommended)

```bash
# Convert an MP3 file
node convert-mp3.js your-file.mp3

# Or use npm script
npm run convert your-file.mp3
```

The script will:
- Convert to PCM 16-bit format
- Set sample rate to 44.1kHz
- Set to stereo (2 channels)
- Output: `your-file.wav` (in the same directory)

### Method 2: Using FFmpeg Directly

```bash
# Install ffmpeg if you don't have it
# macOS: brew install ffmpeg
# Ubuntu/Debian: sudo apt install ffmpeg
# Windows: Download from https://ffmpeg.org/download.html

# Convert MP3 to WAV
ffmpeg -i your-file.mp3 -acodec pcm_s16le -ar 44100 -ac 2 output.wav
```

**Parameters explained:**
- `-i your-file.mp3` - Input file
- `-acodec pcm_s16le` - Use PCM 16-bit codec (uncompressed)
- `-ar 44100` - Sample rate 44.1kHz (CD quality)
- `-ac 2` - 2 audio channels (stereo)
- `output.wav` - Output filename

### Method 3: Using Online Converter

Visit: https://convertio.co/mp3-wav/

1. Upload your MP3 file
2. Make sure to select **PCM 16-bit** format if asked
3. Download the converted WAV file

### Method 4: macOS Built-in Tool

If you're on macOS, you can use the built-in `afconvert`:

```bash
afconvert your-file.mp3 -f WAVE -d LEI16@44100 output.wav
```

## Verifying Your WAV File

Before uploading to the steganography system, verify your WAV file is in the correct format:

```bash
# Check file format (ffmpeg)
ffmpeg -i your-file.wav

# Look for:
# - Audio: pcm_s16le (PCM signed 16-bit little-endian)
# - Sample Rate: 44100 Hz
# - Channels: 2 (stereo)
```

## Common Issues

### Issue: "Invalid audio format" or "Unsupported audio format"

**Cause:** Your WAV file is not in PCM format. It might be:
- IEEE Float format
- A-law or μ-law compressed
- Other compressed format

**Solution:** Re-convert using the method above, ensuring PCM 16-bit format.

### Issue: "Audio file is too small"

**Cause:** The WAV file is too short to hold your message.

**Solution:**
- Use a longer audio file
- Reduce the length of your message
- Audio capacity = (file_size_in_bytes / 2) / 8 characters (approximately)

## Audio Capacity Calculator

To estimate how many characters you can hide in your audio file:

```
Capacity (characters) ≈ (File Size in KB) × 50

Example:
- 1 MB WAV file ≈ 50,000 characters
- 2 MB WAV file ≈ 100,000 characters
- 5 MB WAV file ≈ 250,000 characters
```

## Quick Reference

| Format | Supported | Action |
|--------|-----------|--------|
| WAV (PCM 16-bit) | ✅ Yes | Upload directly |
| WAV (other formats) | ❌ No | Re-convert to PCM 16-bit |
| MP3 | ❌ No | Convert to WAV |
| AAC/M4A | ❌ No | Convert to WAV |
| FLAC | ❌ No | Convert to WAV |
| OGG | ❌ No | Convert to WAV |

## Need Help?

If you continue to have issues:
1. Verify ffmpeg is installed: `ffmpeg -version`
2. Check your file format: `ffmpeg -i your-file.wav`
3. Try a different conversion method
4. Ensure the output file is truly PCM 16-bit WAV
