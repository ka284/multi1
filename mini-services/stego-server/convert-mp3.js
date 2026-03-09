#!/usr/bin/env node
/**
 * MP3 to WAV Converter Script
 * Converts MP3 files to uncompressed PCM WAV format for steganography
 *
 * Usage: node convert-mp3.js <input-mp3-file> [output-wav-file]
 */

import { exec } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

const inputPath = process.argv[2];
let outputPath = process.argv[3];

if (!inputPath) {
  console.error('❌ Error: No input file specified');
  console.log('\nUsage: node convert-mp3.js <input-mp3-file> [output-wav-file]');
  console.log('\nExample:');
  console.log('  node convert-mp3.js AUDIO-2026-03-06-23-59-03.mp3');
  console.log('  node convert-mp3.js AUDIO-2026-03-06-23-59-03.mp3 audio-output.wav');
  process.exit(1);
}

const resolvedInputPath = resolve(inputPath);

if (!existsSync(resolvedInputPath)) {
  console.error(`❌ Error: Input file not found: ${inputPath}`);
  console.log(`   Full path: ${resolvedInputPath}`);
  process.exit(1);
}

// Auto-generate output path if not provided
if (!outputPath) {
  const inputBasename = inputPath.replace(/\.mp3$/i, '');
  outputPath = `${inputBasename}.wav`;
}

const resolvedOutputPath = resolve(outputPath);

console.log('🎵 MP3 to WAV Converter');
console.log('='.repeat(50));
console.log(`Input:  ${inputPath}`);
console.log(`Output: ${outputPath}`);
console.log('Parameters: PCM 16-bit, 44.1kHz, Stereo');
console.log('');

// Convert using ffmpeg
const cmd = `ffmpeg -i "${resolvedInputPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${resolvedOutputPath}" -y 2>&1`;

console.log('🔄 Converting...');

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Conversion failed!');
    console.error(error.message);
    console.error('\nPlease make sure ffmpeg is installed:');
    console.error('  macOS: brew install ffmpeg');
    console.error('  Or use: https://convertio.co/mp3-wav/');
    process.exit(1);
  }

  console.log('✅ Conversion completed successfully!');
  console.log(`\n📁 Output file: ${outputPath}`);
  console.log(`\nYou can now upload this WAV file to the steganography system.`);

  // Get file size info
  const stats = statSync(resolvedOutputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📊 File size: ${sizeMB} MB`);
});
