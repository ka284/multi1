// Encryption Module - Dual-Layer: DES + AES-256-CBC
import crypto from 'crypto';

const DES_ALGORITHM = 'des-cbc';
const AES_ALGORITHM = 'aes-256-cbc';

const DES_KEY_LENGTH = 8;   // DES uses 64-bit key (8 bytes)
const DES_IV_LENGTH = 8;    // DES uses 64-bit block size (8 bytes)
const AES_KEY_LENGTH = 32;  // AES-256 uses 256-bit key (32 bytes)
const AES_IV_LENGTH = 16;   // AES uses 128-bit block size (16 bytes)

/**
 * Generate random salts for both encryption layers
 */
export function generateSalt() {
  return {
    desSalt: crypto.randomBytes(16),
    aesSalt: crypto.randomBytes(16)
  };
}

/**
 * Generate random IVs for both encryption layers
 */
export function generateIVs() {
  return {
    desIV: crypto.randomBytes(DES_IV_LENGTH),
    aesIV: crypto.randomBytes(AES_IV_LENGTH)
  };
}

/**
 * Derive DES key from password using PBKDF2
 */
export function deriveDESKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, DES_KEY_LENGTH, 'sha256');
}

/**
 * Derive AES key from password using PBKDF2
 */
export function deriveAESKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, AES_KEY_LENGTH, 'sha256');
}

/**
 * Encrypt using DES-CBC (Inner Layer)
 */
export function encryptDES(message, key, iv) {
  const cipher = crypto.createCipheriv(DES_ALGORITHM, key, iv);
  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * Decrypt using DES-CBC (Inner Layer)
 */
export function decryptDES(encryptedData, key, iv) {
  const decipher = crypto.createDecipheriv(DES_ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt using AES-256-CBC (Outer Layer)
 */
export function encryptAES(message, key, iv) {
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * Decrypt using AES-256-CBC (Outer Layer)
 */
export function decryptAES(encryptedData, key, iv) {
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Dual-Layer Encryption: DES (inner) + AES (outer)
 */
export function encryptWithPassword(message, password) {
  // Generate salts and IVs
  const { desSalt, aesSalt } = generateSalt();
  const { desIV, aesIV } = generateIVs();

  // Derive keys
  const desKey = deriveDESKey(password, desSalt);
  const aesKey = deriveAESKey(password, aesSalt);

  // First layer: DES encryption
  const desEncrypted = encryptDES(message, desKey, desIV);

  // Second layer: AES encryption of the DES encrypted data
  const aesEncrypted = encryptAES(desEncrypted, aesKey, aesIV);

  return {
    encryptedData: aesEncrypted,
    desSalt: desSalt.toString('base64'),
    desIV: desIV.toString('base64'),
    aesSalt: aesSalt.toString('base64'),
    aesIV: aesIV.toString('base64')
  };
}

/**
 * Dual-Layer Decryption: AES (outer) + DES (inner)
 */
export function decryptWithPassword(encryptedData, password, desSalt, desIV, aesSalt, aesIV) {
  // Convert base64 to buffers
  const desSaltBuffer = Buffer.from(desSalt, 'base64');
  const desIVBuffer = Buffer.from(desIV, 'base64');
  const aesSaltBuffer = Buffer.from(aesSalt, 'base64');
  const aesIVBuffer = Buffer.from(aesIV, 'base64');

  // Derive keys
  const aesKey = deriveAESKey(password, aesSaltBuffer);
  const desKey = deriveDESKey(password, desSaltBuffer);

  // First layer: AES decryption
  const desEncrypted = decryptAES(encryptedData, aesKey, aesIVBuffer);

  // Second layer: DES decryption
  const message = decryptDES(desEncrypted, desKey, desIVBuffer);

  return message;
}
