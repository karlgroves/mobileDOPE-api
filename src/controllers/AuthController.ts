import { type Request, type Response } from 'express';

import User from '../models/User';
import { AuthenticationError, ConflictError, NotFoundError } from '../utils/errors';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { logAuth } from '../utils/logger';
import { sendSuccess, sendCreated } from '../utils/response';

/**
 * Authentication Controller
 *
 * Handles user registration, login, token refresh, and password reset.
 */

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken?: string;
}

interface VerifyEmailBody {
  token: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

export class AuthController {
  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response) {
    const { email, password, name } = req.body as RegisterBody;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      password_hash: passwordHash,
      name,
      is_active: true,
      is_verified: false,
    });

    // Generate verification token
    await user.generateVerificationToken();

    logAuth('user_registered', user.id, { email });

    // TODO: Send verification email with verificationToken

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email, user.token_version);

    return sendCreated(res, {
      user: user.toJSON(),
      ...tokens,
      verificationRequired: true,
    });
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginBody;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AuthenticationError('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Update login info
    await user.recordLogin();

    logAuth('user_login', user.id, { email });

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email, user.token_version);

    return sendSuccess(res, {
      user: user.toJSON(),
      ...tokens,
    });
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body as RefreshBody;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findByPk(payload.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AuthenticationError('Account is inactive');
    }

    // Check token version for revocation
    if (payload.tokenVersion !== undefined && payload.tokenVersion < user.token_version) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    logAuth('token_refreshed', user.id);

    // Generate new tokens
    const tokens = generateTokenPair(user.id, user.email, user.token_version);

    return sendSuccess(res, tokens);
  }

  /**
   * Verify email with token
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response) {
    const { token } = req.body as VerifyEmailBody;

    // Find user with verification token (token is hashed for storage)
    const user = await User.findByVerificationToken(token);

    if (!user) {
      throw new NotFoundError('Invalid or expired verification token');
    }

    // Check if token is expired
    if (user.email_verification_expires && user.email_verification_expires < new Date()) {
      throw new AuthenticationError('Verification token has expired');
    }

    // Mark user as verified
    user.is_verified = true;
    user.email_verification_token = undefined;
    user.email_verification_expires = undefined;
    await user.save();

    logAuth('email_verified', user.id, { email: user.email });

    return sendSuccess(res, undefined, 'Email verified successfully');
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body as ForgotPasswordBody;

    // Find user
    const user = await User.findOne({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return sendSuccess(res, undefined, 'If the email exists, a reset link has been sent');
    }

    // Generate reset token
    await user.generatePasswordResetToken();

    logAuth('password_reset_requested', user.id, { email });

    // TODO: Send password reset email with resetToken

    return sendSuccess(res, undefined, 'If the email exists, a reset link has been sent');
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body as ResetPasswordBody;

    // Find user with reset token (token is hashed for storage)
    const user = await User.findByResetToken(token);

    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    // Check if token is expired
    if (user.password_reset_expires && user.password_reset_expires < new Date()) {
      throw new AuthenticationError('Reset token has expired');
    }

    // Hash new password
    user.password_hash = await User.hashPassword(password);

    // Clear reset token and revoke all existing sessions
    await user.clearPasswordResetToken();
    await user.revokeAllTokens();

    logAuth('password_reset', user.id, { email: user.email });

    return sendSuccess(res, undefined, 'Password reset successfully');
  }

  /**
   * Logout user (client-side token removal)
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response) {
    const user = req.user;

    if (user) {
      // Revoke all existing tokens by incrementing token_version
      await user.revokeAllTokens();
      logAuth('user_logout', user.id);
    }

    return sendSuccess(res, undefined, 'Logged out successfully');
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  getProfile(req: Request, res: Response) {
    const user = req.user;

    return sendSuccess(res, {
      user: user?.toJSON(),
    });
  }
}

export default new AuthController();
