import sharp from 'sharp';
import { spawnSync } from 'child_process';
import { unlinkSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HEADER_DELIMITER = '|||';
const MAX_HEADER_SIZE = 2000;
const FRAME_SKIP = 1; // Process every Nth frame
const SAMPLE_FPS = 1; // Process 1 frame per second for normal videos
const PNG_COMPRESSION_LEVEL = 0; // Faster frame writes
const PNG_EFFORT = 1; // Lower CPU usage for PNG encoding
const MAX_MESSAGE_BYTES = 100000;

/**
 * Execute a command without invoking a shell.
 */
function runCommand(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf-8' });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const stderr = result.stderr || '';
    const stdout = result.stdout || '';
    throw new Error(`${command} failed (${result.status}): ${(stderr || stdout).trim()}`);
  }

  return result;
}

/**
 * Probe video duration in seconds.
 */
function getVideoDuration(inputPath) {
  const result = runCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath
  ]);

  return parseFloat((result.stdout || '').trim()) || 0;
}

/**
 * Probe source video frame rate.
 */
function getVideoFPS(inputPath) {
  const result = runCommand('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=r_frame_rate',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath
  ]);

  const fpsOutput = (result.stdout || '').trim();
  if (!fpsOutput) return 30;
  if (fpsOutput.includes('/')) {
    const [num, den] = fpsOutput.split('/').map(Number);
    return den > 0 ? num / den : 30;
  }

  return parseFloat(fpsOutput) || 30;
}

function bytesToBinary(bytes) {
  if (!bytes || bytes.length === 0) return '';
  return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join('');
}

function binaryToBytes(binary) {
  if (!binary) return new Uint8Array(0);
  const usableLength = binary.length - (binary.length % 8);
  const bytes = new Uint8Array(usableLength / 8);

  for (let i = 0; i < usableLength; i += 8) {
    bytes[i / 8] = parseInt(binary.slice(i, i + 8), 2);
  }

  return bytes;
}

/**
 * UTF-8 string to binary conversion
 */
function stringToBinary(str) {
  if (!str) return '';
  return bytesToBinary(new TextEncoder().encode(str));
}

/**
 * Binary to UTF-8 string conversion
 */
function binaryToString(binary) {
  if (!binary) return '';
  return new TextDecoder().decode(binaryToBytes(binary));
}

/**
 * Extract frames from video using ffmpeg
 * @param {string} inputPath - Path to input video
 * @param {string} outputDir - Directory to save frames
 * @param {boolean} extractAllFrames - If true, extract all frames (for decoding)
 * @param {number|null} maxFrames - Optional cap on extracted frames
 */
async function extractFrames(inputPath, outputDir, extractAllFrames = false, maxFrames = null) {
  try {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Extract frames with ffmpeg - use frame-based extraction to handle short videos
    console.log(`[Video Extract] Extracting frames from: ${inputPath}`);
    
    // First, get the video duration to decide extraction strategy
    let duration = 0;
    try {
      duration = getVideoDuration(inputPath);
      console.log(`[Video Extract] Video duration: ${duration}s`);
    } catch (e) {}
    
    let args;
    if (extractAllFrames) {
      // For decoding: extract all frames while normalizing dimensions.
      console.log(`[Video Extract] Decoding mode - extracting ALL frames`);
      args = [
        '-threads', '0',
        '-i', inputPath,
        '-vf', 'format=rgb24',
        '-vsync', 'vfr',
        ...(maxFrames && maxFrames > 0 ? ['-frames:v', String(maxFrames)] : []),
        '-compression_level', '1',
        join(outputDir, 'frame_%06d.png'),
        '-y'
      ];
    } else if (duration < 1) {
      // For very short videos during encoding, extract a fixed number of frames
      console.log(`[Video Extract] Short video detected, extracting first 10 frames`);
      args = [
        '-threads', '0',
        '-i', inputPath,
        '-vf', 'select=gt(n\\,0),format=rgb24',
        '-vsync', 'vfr',
        '-frames:v', '10',
        '-compression_level', '1',
        join(outputDir, 'frame_%06d.png'),
        '-y'
      ];
    } else {
      // For normal videos, sample at fixed FPS for speed.
      args = [
        '-threads', '0',
        '-i', inputPath,
        '-vf', `fps=${SAMPLE_FPS},format=rgb24`,
        '-vsync', 'vfr',
        '-compression_level', '1',
        join(outputDir, 'frame_%06d.png'),
        '-y'
      ];
    }
    
    try {
      runCommand('ffmpeg', args);
    } catch (e) {
      console.error('[Video Extract] FFmpeg failed:', e.message);
      // Try alternative method: extract single frame
      try {
        console.log(`[Video Extract] Trying alternative extraction method...`);
        runCommand('ffmpeg', [
          '-i', inputPath,
          '-vf', 'format=rgb24',
          '-vframes', '1',
          join(outputDir, 'frame_000001.png'),
          '-y'
        ]);
        console.log(`[Video Extract] Alternative method succeeded`);
      } catch (e2) {
        console.error('[Video Extract] Alternative method also failed:', e2.message);
        throw new Error('Frame extraction failed. The video file may be corrupted, too short, or in an unsupported format.');
      }
    }

    // Get list of extracted frames
    const frames = readdirSync(outputDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    if (frames.length === 0) {
      throw new Error('No frames extracted - video may be corrupted, too short, or in an unsupported format. Try using a longer video (10+ seconds) in MP4 format.');
    }

    console.log(`[Video Extract] Successfully extracted ${frames.length} frames`);
    return frames;
  } catch (error) {
    console.error('Frame extraction error:', error.message);
    throw new Error(`Frame extraction failed: ${error.message}`);
  }
}

/**
 * Rebuild video from frames using ffmpeg with FIXED FPS for consistency
 */
async function rebuildVideo(framesDir, originalVideo, outputPath) {
  try {
    // Count frames in the frames directory
    const frames = readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const frameCount = frames.length;
    console.log(`[Video Rebuild] Frame count: ${frameCount}`);

    if (frameCount === 0) {
      throw new Error('No frames to rebuild video');
    }

    // Get the first frame to determine dimensions
    const firstFramePath = join(framesDir, frames[0]);
    const firstFrameMeta = await sharp(firstFramePath).metadata();
    const width = firstFrameMeta.width || 1920;
    const height = firstFrameMeta.height || 1080;

    console.log(`[Video Rebuild] Dimensions: ${width}x${height}`);

    // Try to get original video's frame rate and duration
    let originalFPS = 30; // Default to 30 fps
    let originalDuration = 0;
    try {
      originalFPS = getVideoFPS(originalVideo);
      console.log(`[Video Rebuild] Original FPS: ${originalFPS}`);
    } catch (e) {
      console.log(`[Video Rebuild] Could not detect FPS, using default: ${originalFPS}`);
    }

    try {
      originalDuration = getVideoDuration(originalVideo);
      console.log(`[Video Rebuild] Original duration: ${originalDuration}s`);
    } catch (e) {
      console.log('[Video Rebuild] Could not detect duration');
    }

    // Preserve source motion profile for HD output fidelity.
    const outputFPS = originalFPS > 0 ? originalFPS : 30;

    console.log(`[Video Rebuild] Frame count: ${frameCount}, Output FPS: ${outputFPS}`);

    // Use container-aware, lossless codecs first and retry with safe fallbacks.
    const inputPattern = join(framesDir, 'frame_%06d.png');
    const outputExt = extname(outputPath).toLowerCase();
    const commonArgs = ['-threads', '0', '-framerate', String(outputFPS), '-i', inputPattern, '-an'];
    let rebuildCommands;

    if (outputExt === '.mp4' || outputExt === '.m4v') {
      rebuildCommands = [
        [...commonArgs, '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'veryfast', '-pix_fmt', 'rgb24', '-movflags', '+faststart', '-y', outputPath],
        [...commonArgs, '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-y', outputPath]
      ];
    } else if (outputExt === '.mov') {
      rebuildCommands = [
        [...commonArgs, '-c:v', 'png', '-pix_fmt', 'rgb24', '-y', outputPath],
        [...commonArgs, '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'veryfast', '-pix_fmt', 'rgb24', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-y', outputPath]
      ];
    } else if (outputExt === '.avi') {
      rebuildCommands = [
        [...commonArgs, '-c:v', 'rawvideo', '-pix_fmt', 'rgb24', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffvhuff', '-pix_fmt', 'bgr0', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-pix_fmt', 'bgr0', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-y', outputPath]
      ];
    } else if (outputExt === '.webm') {
      rebuildCommands = [
        [...commonArgs, '-c:v', 'libvpx-vp9', '-lossless', '1', '-pix_fmt', 'gbrp', '-y', outputPath],
        [...commonArgs, '-c:v', 'libvpx-vp9', '-lossless', '1', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-y', outputPath]
      ];
    } else {
      rebuildCommands = [
        [...commonArgs, '-c:v', 'ffv1', '-pix_fmt', 'rgb24', '-level', '1', '-g', '1', '-slices', '16', '-slicecrc', '0', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-pix_fmt', 'bgr0', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffv1', '-y', outputPath],
        [...commonArgs, '-c:v', 'ffvhuff', '-pix_fmt', 'bgr0', '-y', outputPath]
      ];
    }

    console.log(`[Video Rebuild] Running ffmpeg...`);
    let rebuildSucceeded = false;
    let lastFfmpegError = '';
    for (let i = 0; i < rebuildCommands.length; i++) {
      try {
        runCommand('ffmpeg', rebuildCommands[i]);
        rebuildSucceeded = true;
        if (i > 0) {
          console.log(`[Video Rebuild] Succeeded with fallback command #${i + 1}`);
        }
        break;
      } catch (e) {
        lastFfmpegError = e?.message || 'Unknown ffmpeg error';
        console.warn(`[Video Rebuild] ffmpeg command #${i + 1} failed`);
      }
    }

    if (!rebuildSucceeded) {
      const shortError = String(lastFfmpegError).split('\n').slice(-12).join('\n');
      throw new Error(`All rebuild commands failed. ffmpeg output:\n${shortError}`);
    }

    // Verify the output file was created
    if (!existsSync(outputPath)) {
      throw new Error('Output video file was not created');
    }

    // Verify the output file is valid
    try {
      const duration = getVideoDuration(outputPath);
      console.log(`[Video Rebuild] Output video duration: ${duration}s`);
      if (duration <= 0.01) {
        console.warn(`[Video Rebuild] Warning: Output video is very short (${duration}s)`);
      }
    } catch (e) {
      console.warn(`[Video Rebuild] Could not verify duration: ${e.message}`);
    }

    return outputPath;
  } catch (error) {
    console.error('Video rebuild error:', error.message);
    throw new Error(`Video rebuild failed: ${error.message}`);
  }
}

/**
 * Calculate video capacity (in characters)
 */
export async function calculateVideoCapacity(inputPath) {
  const tempDir = join(__dirname, `../temp_video_capacity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  try {
    mkdirSync(tempDir, { recursive: true });

    // Get duration from video
    const duration = getVideoDuration(inputPath);

    if (duration <= 0) return 0;

    // Extract first frame to get resolution
    try {
      runCommand('ffmpeg', [
        '-i', inputPath,
        '-vframes', '1',
        '-vf', 'format=rgb24',
        join(tempDir, 'temp_frame.png'),
        '-y'
      ]);
    } catch (e) {}

    const firstFrame = join(tempDir, 'temp_frame.png');
    if (!existsSync(firstFrame)) {
      return 0;
    }

    const metadata = await sharp(firstFrame).metadata();
    const width = metadata?.width || 0;
    const height = metadata?.height || 0;
    const channels = metadata?.channels || 3;

    console.log(`[Video Capacity] Resolution: ${width}x${height}, Channels: ${channels}`);

    // Estimate frames from original FPS to match full-frame encode strategy.
    let fps = 30;
    try {
      fps = getVideoFPS(inputPath);
    } catch (e) {}
    const totalFrames = Math.max(1, Math.floor(duration * fps)); // At least 1 frame
    const effectiveFrames = Math.max(1, Math.floor(totalFrames / FRAME_SKIP)); // At least 1 frame

    const pixelsPerFrame = width * height * channels;
    const totalPixels = pixelsPerFrame * effectiveFrames;
    const availableBits = Math.max(0, totalPixels - MAX_HEADER_SIZE); // Ensure not negative

    const capacity = Math.floor(availableBits / 8);
    
    console.log(`[Video Capacity] Duration: ${duration}s, Total frames: ${totalFrames}, Effective frames: ${effectiveFrames}`);
    console.log(`[Video Capacity] Pixels per frame: ${pixelsPerFrame}, Total pixels: ${totalPixels}, Available bits: ${availableBits}`);
    console.log(`[Video Capacity] Calculated capacity: ${capacity} characters`);

    // Cleanup
    try {
      unlinkSync(firstFrame);
    } catch (e) {}

    return Math.max(0, capacity);
  } catch (error) {
    console.error('Video capacity calculation error:', error);
    return 0;
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

/**
 * Check if file is a supported video format
 * Now supports ALL video formats (MP4, AVI, MOV, MKV, WebM, etc.)
 */
export function isSupportedVideo(mimetype) {
  // Accept all video types - ffmpeg will handle format conversion
  return typeof mimetype === 'string' && mimetype.startsWith('video/');
}

/**
 * Encode message into video frames using LSB
 */
export async function encodeVideoMessage(inputPath, data, outputPath) {
  const tempDir = join(__dirname, `../temp_video_encode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    if (!inputPath || !data || !outputPath) {
      throw new Error('Invalid parameters');
    }

    console.log(`[Video Encode] Starting encode process...`);

    // Extract all frames to preserve original motion quality and improve decode reliability.
    const frames = await extractFrames(inputPath, tempDir, true);

    if (frames.length === 0) {
      throw new Error('No frames extracted from video');
    }

    console.log(`[Video Encode] Extracted ${frames.length} frames`);

    // Prepare data to embed
    const dataBytes = new TextEncoder().encode(data);
    const headerText = `MSG:${dataBytes.length}${HEADER_DELIMITER}`;
    const headerBinary = stringToBinary(headerText);
    const dataBinary = bytesToBinary(dataBytes);
    const totalBinary = headerBinary + dataBinary;
    let binaryIndex = 0;

    // Encode data into selected frames
    for (let i = 0; i < frames.length && binaryIndex < totalBinary.length; i++){
      const framePath = join(tempDir, frames[i]);
      
      try {
        const result = await sharp(framePath)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        if (!result || !result.data) continue;

        const { data: pixels, info } = result;
        const { width, height, channels } = info;

        // Encode bits into this frame
        for (let j = 0; j < pixels.length && binaryIndex < totalBinary.length; j++) {
          const bit = parseInt(totalBinary[binaryIndex]);
          pixels[j] = (pixels[j] & 0xFE) | bit;
          binaryIndex++;
        }

        // Save modified frame
        await sharp(pixels, {
          raw: { width, height, channels }
        })
          .png({ compressionLevel: PNG_COMPRESSION_LEVEL, effort: PNG_EFFORT })
          .toFile(framePath);
      } catch (e) {
        console.error(`Error processing frame ${frames[i]}:`, e);
      }
    }

    if (binaryIndex < totalBinary.length) {
      throw new Error(`Message too large for video (embedded ${binaryIndex}/${totalBinary.length} bits)`);
    }

    console.log(`[Video Encode] Embedded ${totalBinary.length} bits into video`);

    // Rebuild video with modified frames
    await rebuildVideo(tempDir, inputPath, outputPath);

    console.log(`[Video Encode] Successfully encoded video to ${outputPath}`);

    return outputPath;
  } catch (error) {
    throw new Error(`Video encoding failed: ${error.message}`);
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

/**
 * Decode message from video frames
 */
export async function decodeVideoMessage(inputPath) {
  const tempDir = join(__dirname, `../temp_video_decode_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    if (!inputPath) {
      throw new Error('Invalid video path');
    }

    console.log(`[Video Decode] Starting decode process...`);

    const tryDecodeWithFrames = async (extractAllFrames, maxFrames = null) => {
      const frames = await extractFrames(inputPath, tempDir, extractAllFrames, maxFrames);

      if (frames.length === 0) {
        throw new Error('No frames extracted from video - the stego video may be corrupted');
      }

      console.log(`[Video Decode] Extracted ${frames.length} frames (${extractAllFrames ? 'all' : 'sampled'}${maxFrames ? `, max=${maxFrames}` : ''})`);

      const extractedBits = [];
      let foundDelimiter = false;
      let headerEndIndex = -1;
      let messageLength = NaN;
      let requiredTotalBits = null;
      const delimiterBinary = stringToBinary(HEADER_DELIMITER);
      const delimiterLength = delimiterBinary.length;
      let recentBits = '';

      for (let i = 0; i < frames.length; i++) {
        const framePath = join(tempDir, frames[i]);

        try {
          const result = await sharp(framePath)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          if (!result || !result.data) continue;

          const { data: pixels } = result;

          for (let j = 0; j < pixels.length; j++) {
            const bit = (pixels[j] & 1).toString();
            extractedBits.push(bit);

            if (!foundDelimiter) {
              recentBits += bit;
              if (recentBits.length > delimiterLength) {
                recentBits = recentBits.slice(-delimiterLength);
              }

              if (recentBits === delimiterBinary) {
                const candidateHeaderEnd = extractedBits.length - delimiterLength;
                const candidateHeaderText = binaryToString(extractedBits.slice(0, candidateHeaderEnd).join(''));
                const match = candidateHeaderText.match(/MSG:(\d+)$/);
                const candidateLength = match ? parseInt(match[1], 10) : NaN;

                if (!isNaN(candidateLength) && candidateLength > 0 && candidateLength <= MAX_MESSAGE_BYTES) {
                  headerEndIndex = candidateHeaderEnd;
                  messageLength = candidateLength;
                  requiredTotalBits = headerEndIndex + delimiterBinary.length + (messageLength * 8);
                  foundDelimiter = true;
                  console.log(`[Video Decode] Found delimiter at bit ${headerEndIndex}`);
                  console.log(`[Video Decode] Message length from header: ${messageLength}`);
                }
              }
            }

            if (requiredTotalBits !== null && extractedBits.length >= requiredTotalBits) {
              break;
            }
          }

          if (requiredTotalBits !== null && extractedBits.length >= requiredTotalBits) {
            break;
          }
        } catch (e) {
          console.error(`Error processing frame ${frames[i]}:`, e);
        }
      }

      if (headerEndIndex === -1 || !foundDelimiter) {
        throw new Error('No hidden message found in video - delimiter not found');
      }

      if (isNaN(messageLength) || messageLength <= 0 || messageLength > MAX_MESSAGE_BYTES) {
        throw new Error('Invalid message length');
      }

      const messageStartIndex = headerEndIndex + delimiterBinary.length;
      const messageEndIndex = messageStartIndex + (messageLength * 8);

      if (messageEndIndex > extractedBits.length) {
        throw new Error(`Video message incomplete (need ${messageEndIndex} bits, have ${extractedBits.length})`);
      }

      const messageBinary = extractedBits.slice(messageStartIndex, messageEndIndex).join('');
      const message = new TextDecoder().decode(binaryToBytes(messageBinary));

      console.log(`[Video Decode] Successfully extracted message (${message.length} chars)`);
      return message;
    };

    // Fast path: most short messages are fully contained in frame 1.
    try {
      return await tryDecodeWithFrames(true, 1);
    } catch (firstFrameError) {
      console.warn(`[Video Decode] First-frame decode failed, retrying with all frames: ${firstFrameError.message}`);
    }

    return await tryDecodeWithFrames(true);
  } 
  catch (error) {
    throw new Error(`Video decoding failed: ${error.message}`);
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
} 
