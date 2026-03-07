// Audio Steganography Module - LSB on WAV audio
// Note: All audio formats are auto-converted to WAV in index.js before calling this module
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const HEADER_DELIMITER = '|||';
const MAX_HEADER_SIZE = 1000;

/**
 * Parse WAV file header and extract audio data
 * Supports 8-bit, 16-bit, 24-bit, and 32-bit PCM
 */
function parseWAV(buffer) {
  console.log(`[Audio] Buffer size: ${buffer.length} bytes`);
  
  // WAV file format: RIFF header + fmt chunk + data chunk + audio data
  if (buffer.length < 44) {
    throw new Error('Invalid WAV file: too small');
  }

  // Check RIFF header
  const riff = buffer.toString('ascii', 0, 4);
  console.log(`[Audio] RIFF header: ${riff}`);
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: not a RIFF file (may be MP3 or another format that failed conversion)');
  }

  // Check WAVE format
  const wave = buffer.toString('ascii', 8, 12);
  console.log(`[Audio] WAVE format: ${wave}`);
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: not a WAVE file');
  }

  // Check fmt chunk
  const fmtChunk = buffer.toString('ascii', 12, 16);
  console.log(`[Audio] fmt chunk: ${fmtChunk}`);
  if (fmtChunk !== 'fmt ') {
    throw new Error('Invalid WAV file: no fmt chunk found');
  }

  // Read audio format (PCM must be 1)
  const audioFormat = buffer.readUInt16LE(20);
  console.log(`[Audio] Audio format: ${audioFormat} (1=PCM uncompressed, 3=IEEE Float, 6=A-law, 7=μ-law)`);
  
  if (audioFormat !== 1) {
    const formatNames = {
      1: 'PCM (uncompressed)',
      3: 'IEEE Float',
      6: 'A-law (compressed)',
      7: 'μ-law (compressed)'
    };
    const formatName = formatNames[audioFormat] || `Format ${audioFormat}`;
    throw new Error(`Unsupported audio format: ${formatName}. Audio conversion may have failed. Please ensure ffmpeg is installed and working.`);
  }

  // Read bits per sample
  const bitsPerSample = buffer.readUInt16LE(34);
  console.log(`[Audio] Bits per sample: ${bitsPerSample}`);

  // Only support 8-bit, 16-bit, 24-bit, and 32-bit PCM
  if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
    throw new Error(`Unsupported bits per sample: ${bitsPerSample}. Only 8, 16, 24, or 32-bit PCM is supported.`);
  }

  // Read number of channels
  const numChannels = buffer.readUInt16LE(22);
  console.log(`[Audio] Channels: ${numChannels}`);

  // Find data chunk
  let dataChunkPos = 12;
  let dataSize = 0;
  let headerEnd = 0;

  while (dataChunkPos < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', dataChunkPos, dataChunkPos + 4);
    const chunkSize = buffer.readUInt32LE(dataChunkPos + 4);

    if (chunkId === 'data') {
      dataSize = chunkSize;
      headerEnd = dataChunkPos + 8;
      break;
    }

    // Skip to next chunk
    dataChunkPos += 8 + chunkSize;
  }

  if (headerEnd === 0) {
    throw new Error('Invalid WAV file: no data chunk found');
  }

  console.log(`[Audio] Header end: ${headerEnd}, Data size: ${dataSize}`);

  return {
    header: buffer.subarray(0, headerEnd),
    audioData: buffer.subarray(headerEnd, headerEnd + dataSize),
    dataSize,
    bitsPerSample,
    numChannels
  };
}

/**
 * Rebuild WAV file with modified audio data
 */
function rebuildWAV(header, audioData, originalBitsPerSample, originalNumChannels) {
  const buffer = Buffer.concat([header, audioData]);
  
  // Update bits per sample in header (in case it changed)
  buffer.writeUInt16LE(originalBitsPerSample, 34);
  
  // Update number of channels in header
  buffer.writeUInt16LE(originalNumChannels, 22);
  
  // Update file size in RIFF header
  buffer.writeUInt32LE(buffer.length - 8, 4);
  
  // Update data chunk size
  const dataChunkPos = header.length - 8;
  buffer.writeUInt32LE(audioData.length, dataChunkPos + 4);
  
  console.log(`[Audio] Rebuilt WAV - Total size: ${buffer.length}, Audio data size: ${audioData.length}`);
  
  return buffer;
}

/**
 * Convert string to binary
 */
function stringToBinary(str) {
  if (!str) return '';
  return str
    .split('')
    .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Convert binary to string
 */
function binaryToString(binary) {
  if (!binary) return '';
  const bytes = binary.match(/.{1,8}/g) || [];
  return bytes
    .map(byte => String.fromCharCode(parseInt(byte, 2)))
    .join('');
}

/**
 * Calculate audio file capacity (in characters)
 */
export async function calculateAudioCapacity(inputPath) {
  try {
    const buffer = readFileSync(inputPath);
    const { audioData } = parseWAV(buffer);
    const totalSamples = audioData.length;
    const availableBits = totalSamples - MAX_HEADER_SIZE;
    const capacity = Math.floor(availableBits / 8);
    console.log(`[Audio] Capacity: ${capacity} characters`);
    return Math.max(0, capacity);
  } catch (error) {
    console.error('Capacity calculation error:', error);
    return 0;
  }
}

/**
 * Check if file is a supported audio format
 * Note: This now always returns true since all formats are accepted in index.js
 */
export function isSupportedAudio(mimetype) {
  // Accept all audio types - validation and conversion happens in index.js
  return true;
}

/**
 * Encode message into audio file using LSB
 * Note: Input must be WAV format (conversion happens in index.js)
 */
export async function encodeAudioMessage(inputPath, data, outputPath) {
  try {
    console.log(`[Audio Encode] Input: ${inputPath}`);
    console.log(`[Audio Encode] Output: ${outputPath}`);
    console.log(`[Audio Encode] Data length: ${data.length} chars`);

    if (!inputPath || !data || !outputPath) {
      throw new Error('Invalid parameters');
    }

    // Read WAV file
    const buffer = readFileSync(inputPath);
    const { header, audioData, bitsPerSample, numChannels } = parseWAV(buffer);

    // Create header and data for embedding
    const headerText = `${data.length}${HEADER_DELIMITER}`;
    const headerBinary = stringToBinary(headerText);
    const dataBinary = stringToBinary(data);
    const totalBinary = headerBinary + dataBinary;

    console.log(`[Audio Encode] Total bits to embed: ${totalBinary.length}`);
    console.log(`[Audio Encode] Audio data available: ${audioData.length} bytes`);

    // Check capacity
    if (totalBinary.length > audioData.length) {
      throw new Error(`Message too large for audio file (need ${totalBinary.length} bytes, have ${audioData.length} bytes available)`);
    }

    if (audioData.length < 1000) {
      throw new Error('Audio file is too small. Please use a longer audio file (at least 5-10 seconds recommended).');
    }

    console.log(`[Audio Encode] Embedding ${totalBinary.length} bits into audio`);

    // Encode bits into audio samples (LSB)
    const modifiedAudioData = Buffer.from(audioData);
    for (let i = 0; i < totalBinary.length; i++) {
      const bit = parseInt(totalBinary[i]);
      modifiedAudioData[i] = (modifiedAudioData[i] & 0xFE) | bit;
    }

    // Rebuild WAV file
    const outputBuffer = rebuildWAV(header, modifiedAudioData, bitsPerSample, numChannels);
    writeFileSync(outputPath, outputBuffer);

    console.log(`[Audio Encode] Successfully encoded message into audio`);
    console.log(`[Audio Encode] Output file: ${outputPath}`);
    console.log(`[Audio Encode] Output file size: ${outputBuffer.length} bytes`);

    return outputPath;
  } catch (error) {
    console.error(`[Audio Encode] Error:`, error);
    throw new Error(`Audio encoding failed: ${error.message}`);
  }
}

/**
 * Decode message from audio file
 * Note: Input must be WAV format (conversion happens in index.js)
 */
export async function decodeAudioMessage(inputPath) {
  try {
    console.log(`[Audio Decode] Input: ${inputPath}`);
    console.log(`[Audio Decode] Checking file exists...`);
    
    if (!existsSync(inputPath)) {
      throw new Error(`Audio file not found: ${inputPath}`);
    }

    console.log(`[Audio Decode] Reading file...`);
    const buffer = readFileSync(inputPath);
    console.log(`[Audio Decode] Buffer size: ${buffer.length} bytes`);

    console.log(`[Audio Decode] Parsing WAV header...`);
    const { audioData, bitsPerSample } = parseWAV(buffer);

    console.log(`[Audio Decode] Audio data size: ${audioData.length} bytes, Bits per sample: ${bitsPerSample}`);

    // Extract LSB bits from audio samples
    console.log(`[Audio Decode] Extracting LSB bits...`);
    const extractedBits = [];
    for (let i = 0; i < audioData.length; i++) {
      extractedBits.push((audioData[i] & 1).toString());
    }

    console.log(`[Audio Decode] Extracted ${extractedBits.length} bits, looking for delimiter...`);

    let binaryData = extractedBits.join('');
    const delimiterBinary = stringToBinary(HEADER_DELIMITER);
    const headerEndIndex = binaryData.indexOf(delimiterBinary);

    if (headerEndIndex === -1) {
      throw new Error('No hidden message found in audio. This could mean:\n1. The audio file does not contain a hidden message\n2. The file was modified after encoding\n3. A different password was used during encoding\n4. The file is corrupted\n\nTry encoding a fresh message and decoding with the same password.');
    }

    console.log(`[Audio Decode] Found delimiter at bit ${headerEndIndex}`);

    // Extract message length
    const headerBinary = binaryData.substring(0, headerEndIndex);
    const messageLength = parseInt(binaryToString(headerBinary), 10);

    console.log(`[Audio Decode] Message length from header: ${messageLength}`);

    if (isNaN(messageLength) || messageLength <= 0 || messageLength > 1000000) {
      throw new Error(`Invalid message length: ${messageLength}. The audio file may be corrupted or was not encoded properly.`);
    }

    // Extract actual message
    const messageStartIndex = headerEndIndex + delimiterBinary.length;
    const messageEndIndex = messageStartIndex + (messageLength * 8);

    if (messageEndIndex > binaryData.length) {
      throw new Error(`Audio message incomplete. Need ${messageEndIndex} bits but only have ${binaryData.length} bits available.`);
    }

    const messageBinary = binaryData.substring(messageStartIndex, messageEndIndex);
    const message = binaryToString(messageBinary);

    console.log(`[Audio Decode] Successfully extracted message (${message.length} chars)`);
    console.log(`[Audio Decode] Message preview: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    return message;
  } catch (error) {
    console.error(`[Audio Decode] Error:`, error);
    throw new Error(`Audio decoding failed: ${error.message}`);
  }
}
