import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { UserRole } from '../types/auth';
import { verifyJWT, validatePermission } from '../utils/security';
import { AppError } from '../utils/error-handler';
import { ErrorCode } from '../types/common';
import { logger } from '../utils/logger';

// Cache for storing validated tokens to improve performance
const tokenCache = new Map<string, {
  decoded: any;
  expires: number;
}>();

// Constants
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BEARER_PREFIX = 'Bearer ';
const AUTH_HEADER = 'Authorization';

/**
 * Interface extending Express Request to include user and security context
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    deviceId: string;
  };
  securityContext?: {
    correlationId: string;
    tokenId: string;
    ipAddress: string;
    userAgent: string;
  };
}

/**
 * Middleware to authenticate requests using JWT tokens
 * Implements comprehensive token validation, security logging, and performance optimization
 */
export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Extract token from Authorization header
    const authHeader = req.header(AUTH_HEADER);
    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      throw new AppError('Missing or invalid authorization header', ErrorCode.UNAUTHORIZED);
    }

    const token = authHeader.slice(BEARER_PREFIX.length);

    // Check token cache first
    const cachedToken = tokenCache.get(token);
    if (cachedToken && cachedToken.expires > Date.now()) {
      attachUserContext(req, cachedToken.decoded, correlationId);
      return next();
    }

    // Verify token if not in cache
    const decoded = await verifyJWT(token);

    // Cache successful validation
    tokenCache.set(token, {
      decoded,
      expires: Date.now() + TOKEN_CACHE_TTL
    });

    // Attach user and security context to request
    attachUserContext(req, decoded, correlationId);

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: decoded.sub,
      correlationId,
      tokenId: decoded.jti
    });

    next();
  } catch (error) {
    // Clean up expired tokens from cache
    cleanupTokenCache();

    // Log authentication failure
    logger.error('Authentication failed', {
      correlationId,
      error,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Handle specific JWT errors
    if (error instanceof Error) {
      switch (error.name) {
        case 'TokenExpiredError':
          throw new AppError('Token has expired', ErrorCode.UNAUTHORIZED);
        case 'JsonWebTokenError':
          throw new AppError('Invalid token', ErrorCode.UNAUTHORIZED);
        default:
          throw new AppError('Authentication failed', ErrorCode.UNAUTHORIZED);
      }
    }

    next(error);
  }
}

/**
 * Middleware factory that creates role-based access control middleware
 * Implements role hierarchy validation with enhanced security logging
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('User context not found', ErrorCode.UNAUTHORIZED);
      }

      const hasValidRole = allowedRoles.some(role => {
        return validatePermission(req.user!.role, `role.${role.toLowerCase()}`);
      });

      if (!hasValidRole) {
        throw new AppError(
          'Insufficient permissions',
          ErrorCode.FORBIDDEN,
          {
            requiredRoles: allowedRoles,
            userRole: req.user.role
          }
        );
      }

      // Log successful authorization
      logger.info('Authorization successful', {
        userId: req.user.id,
        role: req.user.role,
        allowedRoles,
        correlationId: req.securityContext?.correlationId
      });

      next();
    } catch (error) {
      // Log authorization failure
      logger.error('Authorization failed', {
        userId: req.user?.id,
        role: req.user?.role,
        allowedRoles,
        correlationId: req.securityContext?.correlationId,
        error
      });

      next(error);
    }
  };
}

/**
 * Helper function to attach user and security context to request
 */
function attachUserContext(
  req: AuthenticatedRequest,
  decoded: any,
  correlationId: string
): void {
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    deviceId: decoded.device_id
  };

  req.securityContext = {
    correlationId,
    tokenId: decoded.jti,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string
  };
}

/**
 * Helper function to clean up expired tokens from cache
 */
function cleanupTokenCache(): void {
  const now = Date.now();
  for (const [token, data] of tokenCache.entries()) {
    if (data.expires <= now) {
      tokenCache.delete(token);
    }
  }
}