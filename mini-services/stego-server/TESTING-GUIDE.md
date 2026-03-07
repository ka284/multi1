# 🧪 Quick Testing Guide

## Your MP3 File is Now Supported! 🎉

You can now directly upload your `AUDIO-2026-03-06-23-59-03.mp3` file without any manual conversion!

---

## Test Your Files

### Test 1: MP3 Audio (Your File)
```
File: AUDIO-2026-03-06-23-59-03.mp3
Action: Upload directly (NO conversion needed!)
Expected: System auto-converts to WAV, encodes message, returns WAV file
```

### Test 2: Any Image
```
File: Any JPG, PNG, WebP, HEIC, TIFF, etc.
Action: Upload directly
Expected: System processes image, returns PNG file
```

### Test 3: Any Video
```
File: Any MP4, AVI, MOV, MKV, WebM, etc.
Action: Upload directly
Expected: System processes video, returns MP4 file
```

---

## Step-by-Step Test

### Encoding Test:

1. Open the web interface
2. Go to **Encode** page
3. Upload `AUDIO-2026-03-06-23-59-03.mp3` directly
4. Enter a test message: "Hello, this is a test message!"
5. Enter a password: "test123"
6. Click **Encode & Encrypt**
7. Wait for processing (may take a few seconds for conversion)
8. Download the resulting WAV file

### Decoding Test:

1. Go to **Decode** page
2. Upload the WAV file you just downloaded
3. Enter the same password: "test123"
4. Click **Decode & Decrypt**
5. Verify you see: "Hello, this is a test message!"

---

## What to Expect

### When Uploading MP3:
- ✅ File uploads successfully (no "Invalid file type" error)
- ✅ System shows "Converting audio to WAV..." in logs
- ✅ Encoding completes successfully
- ✅ Download is a WAV file (not MP3)

### When Uploading Other Formats:
- ✅ All formats accepted without errors
- ✅ System processes appropriately
- ✅ Download is in standard format (PNG for images, WAV for audio, MP4 for video)

---

## Common Success Indicators

✅ **Success signs:**
- "Successfully encoded [type] file" in logs
- "Successfully decoded [type] file" in logs
- Download starts automatically
- File size is reasonable (not 0 bytes)
- Message decodes correctly

❌ **Error signs (that should NOT happen now):**
- "Invalid file type: audio/mpeg" (for MP3)
- "For audio, please upload WAV files only"
- "File too large" errors
- "Unsupported format" errors

---

## File Size Test

### Test with Large Files:

Try uploading:
- Large MP3 (50MB+)
- Large image (10MB+)
- Large video (500MB+)

**Expected:** All should work without size limit errors!

---

## Quick Format Checklist

Test these formats to verify everything works:

### Images:
- [ ] .jpg / .jpeg
- [ ] .png
- [ ] .webp
- [ ] .bmp
- [ ] .gif
- [ ] .tiff / .tif
- [ ] .heic / .heif

### Audio:
- [ ] .mp3 (your file!)
- [ ] .wav
- [ ] .aac / .m4a
- [ ] .ogg
- [ ] .flac
- [ ] .wma

### Video:
- [ ] .mp4
- [ ] .avi
- [ ] .mov
- [ ] .mkv
- [ ] .webm
- [ ] .flv

---

## Troubleshooting

### Issue: "Audio conversion failed"
**Solution:** Check FFmpeg is installed:
```bash
ffmpeg -version
```

### Issue: "Frame extraction failed"
**Solution:** Try a longer video (at least 5 seconds)

### Issue: Download is 0 bytes
**Solution:** Check server logs for specific error message

### Issue: Message doesn't decode
**Solution:** Verify you're using the same password for encoding and decoding

---

## Server Logs

Check the server logs to see what's happening:

**Successful MP3 upload should show:**
```
[Upload] Accepting audio: audio/mpeg, filename: AUDIO-2026-03-06-23-59-03.mp3
[Encode] File type: audio, mimetype: audio/mpeg, filename: AUDIO-2026-03-06-23-59-03.mp3
[Encode] Audio file is not WAV, converting...
[Audio Conversion] Converting ... to WAV...
[Audio Conversion] Successfully converted to WAV
[Audio Encode] Successfully encoded message into audio
[Encode] Successfully encoded audio file
```

---

## Ready to Test! 🚀

Your system now supports:
- ✅ ALL image formats
- ✅ ALL audio formats (your MP3 works directly!)
- ✅ ALL video formats
- ✅ ANY file size

**Go ahead and test your `AUDIO-2026-03-06-23-59-03.mp3` file right now!**
