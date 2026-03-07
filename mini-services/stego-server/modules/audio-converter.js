// Audio Format Converter Module
// Converts various audio formats to WAV for steganography processing
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join, extname } from 'path';

/**
 * Get audio file format from extension or buffer
 */
export function getAudioFormat(filePath) {
  const ext = extname(filePath).toLowerCase();
  const formatMap = {
    '.mp3': 'mp3',
    '.wav': 'wav',
    '.ogg': 'ogg',
    '.flac': 'flac',
    '.aac': 'aac',
    '.m4a': 'm4a',
    '.wma': 'wma',
    '.opus': 'opus',
    '.aiff': 'aiff',
    '.aif': 'aif'
  };
  return formatMap[ext] || 'unknown';
}

/**
 * Check if audio is already in WAV PCM format
 */
export function isWAVPCM(filePath) {
  try {
    // Use ffprobe to check codec
    const cmd = `ffprobe -v error -select_streams a -of default=noprint_wrappers=1:nokey=1 -show_entries stream=codec_name "${filePath}" 2>&1`;
    const codec = execSync(cmd, { encoding: 'utf-8' }).trim();
    console.log(`[Audio Converter] Codec: ${codec}`);
    
    // pcm_s16le is the standard 16-bit PCM format we want
    return codec.includes('pcm');
  } catch (e) {
    console.error('[Audio Converter] Could not detect codec:', e.message);
    return false;
  }
}

/**
 * Convert any audio format to WAV (PCM 16-bit, 44.1kHz, stereo)
 */
export async function convertToWAV(inputPath, outputPath) {
  try {
    console.log(`[Audio Converter] Converting ${inputPath} to WAV...`);
    
    // Check if already in correct format
    if (isWAVPCM(inputPath)) {
      console.log(`[Audio Converter] File is already WAV PCM, copying...`);
      // Copy the file
      execSync(`cp "${inputPath}" "${outputPath}" 2>&1`, { stdio: 'ignore' });
      return outputPath;
    }
    
    // Convert to WAV with ffmpeg
    // Using high quality settings to preserve audio while making it uncompressed
    const cmd = `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${outputPath}" -y 2>&1`;
    
    console.log(`[Audio Converter] Running conversion...`);
    execSync(cmd, { stdio: 'ignore' });
    
    if (!existsSync(outputPath)) {
      throw new Error('Conversion failed: Output file not created');
    }
    
    console.log(`[Audio Converter] Successfully converted to WAV`);
    return outputPath;
  } catch (error) {
    console.error('[Audio Converter] Conversion error:', error.message);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}

/**
 * Convert WAV back to original format (for output)
 * Note: This may lose steganography data due to compression!
 * For MP3/AAC, we recommend outputting as WAV to preserve the hidden data
 */
export async function convertFromWAV(wavPath, outputPath, targetFormat) {
  try {
    // For compressed formats, warn that data may be lost
    const compressedFormats = ['mp3', 'aac', 'm4a', 'ogg', 'wma', 'flac'];
    
    if (compressedFormats.includes(targetFormat)) {
      console.warn(`[Audio Converter] WARNING: Converting to ${targetFormat} (compressed format)`);
      console.warn(`[Audio Converter] This may lose or corrupt the steganography data!`);
      console.warn(`[Audio Converter] Recommend outputting as WAV instead.`);
    }
    
    // Different codec settings based on format
    let codecOptions = '';
    switch (targetFormat) {
      case 'mp3':
        codecOptions = '-acodec libmp3lame -b:a 320k'; // High quality MP3
        break;
      case 'aac':
      case 'm4a':
        codecOptions = '-acodec aac -b:a 256k'; // High quality AAC
        break;
      case 'ogg':
        codecOptions = '-acodec libvorbis -b:a 320k'; // High quality OGG
        break;
      case 'flac':
        codecOptions = '-acodec flac -compression_level 8'; // FLAC (lossless)
        break;
      default:
        // For wav, just copy
        codecOptions = '-acodec copy';
    }
    
    const cmd = `ffmpeg -i "${wavPath}" ${codecOptions} "${outputPath}" -y 2>&1`;
    
    console.log(`[Audio Converter] Converting WAV to ${targetFormat}...`);
    execSync(cmd, { stdio: 'ignore' });
    
    if (!existsSync(outputPath)) {
      throw new Error('Conversion failed: Output file not created');
    }
    
    console.log(`[Audio Converter] Successfully converted to ${targetFormat}`);
    return outputPath;
  } catch (error) {
    console.error('[Audio Converter] Conversion error:', error.message);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}

/**
 * Get the output extension for audio
 * For compressed formats, we output WAV to preserve steganography data
 */
export function getAudioOutputExtension(inputFormat) {
  const losslessFormats = ['wav', 'aiff', 'aif', 'flac'];
  
  // For lossless formats, keep original
  if (losslessFormats.includes(inputFormat)) {
    return `.${inputFormat}`;
  }
  
  // For compressed formats (MP3, AAC, etc.), output WAV to preserve data
  return '.wav';
}

/**
 * Get the content type for audio output
 */
export function getAudioContentType(extension) {
  const contentTypes = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.m4a': 'audio/mp4',
    '.aiff': 'audio/aiff',
    '.aif': 'audio/aiff'
  };
  return contentTypes[extension] || 'audio/wav';
}
