import jwt from 'jsonwebtoken'; // ^9.0.0
import bcrypt from 'bcryptjs'; // ^2.4.3
import crypto from 'crypto';
import { JWT_CONFIG, ENCRYPTION_CONFIG } from '../config/security';
import { UserRole } from '../types/auth';
import { SecurityLogger } from '../utils/logger';

// Initialize security logger
const securityLogger = new SecurityLogger({
  name: 'security-service',
  enableDatadog: process.env.NODE_ENV === 'production'
});

/**
 * Generates a JWT token with enhanced security features
 * @param payload - Data to be encoded in the token
 * @returns Promise<string> - Generated JWT token
 */
export async function generateJWT(payload: Record<string, any>): Promise<string> {
  try {
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + JWT_CONFIG.maxAge,
      jti: crypto.randomUUID()
    };

    const token = jwt.sign(tokenPayload, JWT_CONFIG.privateKey, {
      algorithm: JWT_CONFIG.algorithm,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });

    securityLogger.info('JWT token generated', { userId: payload.sub });
    return token;
  } catch (error) {
    securityLogger.error('JWT generation failed', { error });
    throw error;
  }
}

/**
 * Verifies and decodes a JWT token
 * @param token - JWT token to verify
 * @returns Promise<object> - Decoded token payload
 */
export async function verifyJWT(token: string): Promise<object> {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.publicKey, {
      algorithms: [JWT_CONFIG.algorithm],
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      clockTolerance: JWT_CONFIG.clockTolerance
    });

    securityLogger.info('JWT token verified', { tokenId: (decoded as any).jti });
    return decoded;
  } catch (error) {
    securityLogger.error('JWT verification failed', { error });
    throw error;
  }
}

/**
 * Hashes a password using bcrypt with configurable salt rounds
 * @param password - Password to hash
 * @returns Promise<string> - Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    
    securityLogger.info('Password hashed successfully');
    return hash;
  } catch (error) {
    securityLogger.error('Password hashing failed', { error });
    throw error;
  }
}

/**
 * Compares a password with its hash using constant-time comparison
 * @param password - Password to compare
 * @param hash - Hash to compare against
 * @returns Promise<boolean> - True if password matches hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    securityLogger.info('Password comparison completed');
    return isMatch;
  } catch (error) {
    securityLogger.error('Password comparison failed', { error });
    throw error;
  }
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param data - Data to encrypt
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encryptData(data: string): {
  encrypted: string;
  iv: string;
  tag: string;
  keyVersion: number;
} {
  try {
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
      iv
    ) as crypto.CipherGCM;

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    securityLogger.info('Data encrypted successfully');
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      keyVersion: 1
    };
  } catch (error) {
    securityLogger.error('Data encryption failed', { error });
    throw error;
  }
}

/**
 * Decrypts AES-256-GCM encrypted data
 * @param encryptedData - Object containing encrypted data, IV, and auth tag
 * @returns string - Decrypted data
 */
export function decryptData({
  encrypted,
  iv,
  tag,
  keyVersion
}: {
  encrypted: string;
  iv: string;
  tag: string;
  keyVersion: number;
}): string {
  try {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.algorithm,
      Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
      Buffer.from(iv, 'hex')
    ) as crypto.DecipherGCM;

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    securityLogger.info('Data decrypted successfully');
    return decrypted;
  } catch (error) {
    securityLogger.error('Data decryption failed', { error });
    throw error;
  }
}

/**
 * Validates if a user has required permissions
 * @param userRole - User's role
 * @param requiredPermission - Required permission to check
 * @returns boolean - True if user has permission
 */
export function validatePermission(userRole: UserRole, requiredPermission: string): boolean {
  const roleHierarchy = {
    [UserRole.ADMIN]: 100,
    [UserRole.RECRUITER]: 80,
    [UserRole.HIRING_MANAGER]: 60,
    [UserRole.CANDIDATE]: 40,
    [UserRole.GUEST]: 20
  };

  const permissionLevels = {
    'system.admin': 100,
    'jobs.manage': 80,
    'candidates.view': 60,
    'profile.edit': 40,
    'jobs.view': 20
  };

  const userLevel = roleHierarchy[userRole];
  const requiredLevel = permissionLevels[requiredPermission as keyof typeof permissionLevels];

  const hasPermission = userLevel >= requiredLevel;
  securityLogger.info('Permission validation completed', { 
    userRole, 
    requiredPermission, 
    hasPermission 
  });

  return hasPermission;
}

/**
 * Token manager class for handling JWT operations with caching and monitoring
 */
export class TokenManager {
  private keyCache: Map<string, { publicKey: string; privateKey: string }>;

  constructor() {
    this.keyCache = new Map();
    this.loadKeys();
  }

  private loadKeys(): void {
    this.keyCache.set('current', {
      publicKey: JWT_CONFIG.publicKey,
      privateKey: JWT_CONFIG.privateKey
    });
  }

  async generateToken(payload: Record<string, any>): Promise<string> {
    const keys = this.keyCache.get('current');
    if (!keys) {
      throw new Error('Encryption keys not loaded');
    }

    return generateJWT(payload);
  }

  async verifyToken(token: string): Promise<object> {
    const keys = this.keyCache.get('current');
    if (!keys) {
      throw new Error('Encryption keys not loaded');
    }

    return verifyJWT(token);
  }
}