import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

import { encryptWithPassword, decryptWithPassword } from './modules/encryption.js';
import { encodeMessage, decodeMessage, isSupportedImage, calculateCapacity } from './modules/steganography.js';
import { encodeAudioMessage, decodeAudioMessage, isSupportedAudio, calculateAudioCapacity } from './modules/audio-steganography.js';
import { encodeVideoMessage, decodeVideoMessage, isSupportedVideo, calculateVideoCapacity } from './modules/video-steganography.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3030;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔒 Secure Multimedia Steganography Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🌐 Health check: /api/health`);
  console.log(`📸 Images | 🎵 Audio | 🎬 Video steganography enabled`);
});


app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const uploadDir = join(__dirname, 'uploads');
const tempDir = join(__dirname, 'temp');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

/**
 * Convert audio file to WAV format (PCM 16-bit, 44.1kHz, stereo)
 * This is required for LSB steganography
 */
async function convertAudioToWav(inputPath, outputPath) {
  try {
    console.log(`[Audio Conversion] Converting ${inputPath} to WAV...`);
    const cmd = `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${outputPath}" -y 2>&1`;
    execSync(cmd, { stdio: 'ignore' });
    
    if (!existsSync(outputPath)) {
      throw new Error('WAV conversion failed - output file not created');
    }
    
    console.log(`[Audio Conversion] Successfully converted to WAV`);
    return outputPath;
  } catch (error) {
    console.error('[Audio Conversion] Error:', error.message);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}

/**
 * Check if audio file is already in WAV format
 */
function isWavFile(mimetype, filename) {
  return mimetype === 'audio/wav' || 
         mimetype === 'audio/x-wav' || 
         mimetype === 'audio/wave' ||
         filename.toLowerCase().endsWith('.wav');
}

// Accept ALL image, audio, and video files - NO size limits
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Accept ALL image types
    if (file.mimetype.startsWith('image/')) {
      console.log(`[Upload] Accepting image: ${file.mimetype}, filename: ${file.originalname}`);
      cb(null, true);
      return;
    }
    
    // Accept ALL audio types (MP3, WAV, AAC, M4A, OGG, FLAC, etc.)
    if (file.mimetype.startsWith('audio/')) {
      console.log(`[Upload] Accepting audio: ${file.mimetype}, filename: ${file.originalname}`);
      cb(null, true);
      return;
    }
    
    // Accept ALL video types (MP4, AVI, MOV, MKV, WebM, etc.)
    if (file.mimetype.startsWith('video/')) {
      console.log(`[Upload] Accepting video: ${file.mimetype}, filename: ${file.originalname}`);
      cb(null, true);
      return;
    }
    
    // Check by extension if mimetype is generic or unknown
    const ext = file.originalname.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg', 'ico', 'avif', 'heic', 'heif', 'psd', 'raw', 'cr2', 'nef'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'aiff', 'aif', 'aifc', 'au', 'ra', 'wv'];
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp', 'ts', 'mts', 'm2ts', 'asf', 'rm', 'rmvb', 'vob', 'ogv'];
    
    if (imageExts.includes(ext)) {
      console.log(`[Upload] Accepting image by extension: .${ext}`);
      cb(null, true);
      return;
    }
    
    if (audioExts.includes(ext)) {
      console.log(`[Upload] Accepting audio by extension: .${ext}`);
      cb(null, true);
      return;
    }
    
    if (videoExts.includes(ext)) {
      console.log(`[Upload] Accepting video by extension: .${ext}`);
      cb(null, true);
      return;
    }
    
    console.log(`[Upload] Rejecting file: ${file.mimetype}, extension: .${ext}`);
    cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload an image, audio, or video file.`));
  }
});

// Get file type from mimetype or extension
function getFileType(mimetype, filename) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  
  // Check by extension
  const ext = filename.toLowerCase().split('.').pop();
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg', 'ico', 'avif', 'heic', 'heif'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'aiff', 'aif'];
  const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp', 'ts', 'mts'];
  
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  
  return 'unknown';
}

// Get output file extension based on file type
function getOutputExtension(fileType) {
  const extensions = {
    image: '.png',
    audio: '.wav',
    video: '.avi'
  };
  return extensions[fileType] || '.bin';
}

// Get content type based on file type
function getContentType(fileType) {
  const types = {
    image: 'image/png',
    audio: 'audio/wav',
    video: 'video/x-msvideo/mp4'
  };
  return types[fileType] || 'application/octet-stream';
}

app.post('/api/encode', upload.single('file'), async (req, res) => {
  const timestamp = Date.now();
  let inputPath, outputPath, fileType, convertedPath = null;

  try {
    const { message, password } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!message || !message.trim()) return res.status(400).json({ success: false, error: 'No message' });
    if (!password || !password.trim()) return res.status(400).json({ success: false, error: 'No password' });

    fileType = getFileType(file.mimetype, file.originalname);
    console.log(`[Encode] File type: ${fileType}, mimetype: ${file.mimetype}, filename: ${file.originalname}`);

    const extension = getOutputExtension(fileType);
    inputPath = join(uploadDir, `input_${timestamp}${extension}`);
    outputPath = join(uploadDir, `stego_${timestamp}${extension}`);

    writeFileSync(inputPath, file.buffer);

    // For audio, convert to WAV if not already WAV
    if (fileType === 'audio' && !isWavFile(file.mimetype, file.originalname)) {
      console.log(`[Encode] Audio file is not WAV, converting...`);
      convertedPath = join(tempDir, `converted_${timestamp}.wav`);
      await convertAudioToWav(inputPath, convertedPath);
      
      // Replace inputPath with converted WAV
      unlinkSync(inputPath);
      inputPath = convertedPath;
    }

    // Validate and calculate capacity based on file type
    let capacity = 0;
    if (fileType === 'image') {
      if (!await isSupportedImage(inputPath)) {
        throw new Error('Invalid image file');
      }
      capacity = await calculateCapacity(inputPath);
    } else if (fileType === 'audio') {
      capacity = await calculateAudioCapacity(inputPath);
    } else if (fileType === 'video') {
      capacity = await calculateVideoCapacity(inputPath);
    } else {
      throw new Error('Unsupported file type');
    }

    console.log(`[Encode] File capacity: ${capacity} chars`);

    if (capacity <= 0) {
      throw new Error(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file is too small or has an invalid format. Please use a larger ${fileType} file.`);
    }

    if (message.length > capacity) {
      throw new Error(`Message too large (max: ${capacity} chars for ${fileType})`);
    }

    // Encrypt message
    const { encryptedData, desSalt, desIV, aesSalt, aesIV } = encryptWithPassword(message, password);
    const dataToEmbed = `${encryptedData}@@@${desSalt}@@@${desIV}@@@${aesSalt}@@@${aesIV}`;

    console.log(`[Encode] Data to embed length: ${dataToEmbed.length} chars`);

    // Encode based on file type
    if (fileType === 'image') {
      await encodeMessage(inputPath, dataToEmbed, outputPath);
    } else if (fileType === 'audio') {
      await encodeAudioMessage(inputPath, dataToEmbed, outputPath);
    } else if (fileType === 'video') {
      await encodeVideoMessage(inputPath, dataToEmbed, outputPath);
    }

    const stegoBuffer = readFileSync(outputPath);

    // Cleanup
    unlinkSync(inputPath);
    unlinkSync(outputPath);
    if (convertedPath && existsSync(convertedPath)) {
      unlinkSync(convertedPath);
    }

    // Send response
    res.setHeader('Content-Type', getContentType(fileType));
    res.setHeader('Content-Disposition', `attachment; filename="stego_${timestamp}${extension}"`);
    res.send(stegoBuffer);

    console.log(`[Encode] Successfully encoded ${fileType} file`);

  } catch (error) {
    console.error('[Encode] Error:', error);
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (existsSync(outputPath)) unlinkSync(outputPath);
      if (convertedPath && existsSync(convertedPath)) unlinkSync(convertedPath);
    } catch (e) {}
    res.status(500).json({ success: false, error: error.message || 'Encoding failed' });
  }
});

app.post('/api/decode', upload.single('file'), async (req, res) => {
  const timestamp = Date.now();
  let inputPath, fileType, convertedPath = null;

  try {
    const { password } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!password || !password.trim()) return res.status(400).json({ success: false, error: 'No password' });

    fileType = getFileType(file.mimetype, file.originalname);
    console.log(`[Decode] File type: ${fileType}, mimetype: ${file.mimetype}, filename: ${file.originalname}`);

    const extension = getOutputExtension(fileType);
    inputPath = join(uploadDir, `decode_${timestamp}${extension}`);

    writeFileSync(inputPath, file.buffer);

    // For audio, convert to WAV if not already WAV
    if (fileType === 'audio' && !isWavFile(file.mimetype, file.originalname)) {
      console.log(`[Decode] Audio file is not WAV, converting...`);
      convertedPath = join(tempDir, `converted_decode_${timestamp}.wav`);
      await convertAudioToWav(inputPath, convertedPath);
      
      // Replace inputPath with converted WAV
      unlinkSync(inputPath);
      inputPath = convertedPath;
    }

    // Validate and decode based on file type
    let extractedData;
    if (fileType === 'image') {
      if (!await isSupportedImage(inputPath)) {
        throw new Error('Invalid image file');
      }
      extractedData = await decodeMessage(inputPath);
    } else if (fileType === 'audio') {
      extractedData = await decodeAudioMessage(inputPath);
    } else if (fileType === 'video') {
      extractedData = await decodeVideoMessage(inputPath);
    } else {
      throw new Error('Unsupported file type');
    }

    // Parse extracted data
    const parts = extractedData.split('@@@');
    if (parts.length !== 5) {
      throw new Error('No valid hidden message found');
    }

    const [encryptedData, desSalt, desIV, aesSalt, aesIV] = parts;
    const decryptedMessage = decryptWithPassword(encryptedData, password, desSalt, desIV, aesSalt, aesIV);

    // Cleanup
    unlinkSync(inputPath);
    if (convertedPath && existsSync(convertedPath)) {
      unlinkSync(convertedPath);
    }

    console.log(`[Decode] Successfully decoded ${fileType} file`);

    res.json({ success: true, message: decryptedMessage, fileType });

  } catch (error) {
    console.error('[Decode] Error:', error);
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (convertedPath && existsSync(convertedPath)) unlinkSync(convertedPath);
    } catch (e) {}
    res.status(500).json({ success: false, error: error.message || 'Decoding failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Secure Multimedia Steganography System running',
    supportedFormats: {
      images: ['ALL image formats supported - JPG, PNG, WebP, BMP, GIF, TIFF, SVG, AVIF, HEIC, PSD, RAW, etc.'],
      audio: ['ALL audio formats supported - MP3, WAV, AAC, M4A, OGG, FLAC, WMA, OPUS, AIFF, etc. (auto-converted to WAV)'],
      video: ['ALL video formats supported - MP4, AVI, MOV, MKV, WebM, WMV, FLV, M4V, 3GP, TS, etc.'],
      note: 'No file size limits'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🔒 Secure Multimedia Steganography Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📸 Images: ALL formats | 🎵 Audio: ALL formats (auto-convert to WAV) | 🎬 Video: ALL formats`);
  console.log(`📏 File size: UNLIMITED`);
});
