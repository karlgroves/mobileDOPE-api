import { Request, Response } from 'express';
import User from '../models/User';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { AuthenticationError, ConflictError, NotFoundError } from '../utils/errors';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { logAuth } from '../utils/logger';

/**
 * Authentication Controller
 *
 * Handles user registration, login, token refresh, and password reset.
 */

export class AuthController {
  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response) {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const password_hash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      password_hash,
      name,
      is_active: true,
      is_verified: false,
    });

    // Generate verification token
    const verificationToken = await user.generateVerificationToken();

    logAuth('user_registered', user.id, { email });

    // TODO: Send verification email

    // Generate tokens
    const tokens = generateTokenPair(user.id, user.email);

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
    const { email, password } = req.body;

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
    const tokens = generateTokenPair(user.id, user.email);

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
    const { refreshToken } = req.body;

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

    logAuth('token_refreshed', user.id);

    // Generate new tokens
    const tokens = generateTokenPair(user.id, user.email);

    return sendSuccess(res, tokens);
  }

  /**
   * Verify email with token
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response) {
    const { token } = req.body;

    // Find user with verification token
    const user = await User.findOne({
      where: {
        email_verification_token: token,
      },
    });

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
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return sendSuccess(res, undefined, 'If the email exists, a reset link has been sent');
    }

    // Generate reset token
    const resetToken = await user.generatePasswordResetToken();

    logAuth('password_reset_requested', user.id, { email });

    // TODO: Send password reset email

    return sendSuccess(res, undefined, 'If the email exists, a reset link has been sent');
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body;

    // Find user with reset token
    const user = await User.findOne({
      where: {
        password_reset_token: token,
      },
    });

    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    // Check if token is expired
    if (user.password_reset_expires && user.password_reset_expires < new Date()) {
      throw new AuthenticationError('Reset token has expired');
    }

    // Hash new password
    user.password_hash = await User.hashPassword(password);

    // Clear reset token
    await user.clearPasswordResetToken();

    logAuth('password_reset', user.id, { email: user.email });

    return sendSuccess(res, undefined, 'Password reset successfully');
  }

  /**
   * Logout user (client-side token removal)
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response) {
    const userId = (req as any).userId;

    if (userId) {
      logAuth('user_logout', userId);
    }

    // With JWT, logout is handled client-side by removing tokens
    // In the future, we could implement token blacklisting here
    return sendSuccess(res, undefined, 'Logged out successfully');
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  async getProfile(req: Request, res: Response) {
    const user = (req as any).user;

    return sendSuccess(res, {
      user: user.toJSON(),
    });
  }
}

export default new AuthController();
