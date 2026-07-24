import { sendSuccess } from '../utils/apiResponse.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/cookies.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../utils/constants.js';
import { sanitizeUser } from '../utils/user.js';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../services/token.service.js';
import * as authService from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { user, store, accessToken, refreshToken, emailVerification } =
    await authService.registerUser(req.body);

  setRefreshTokenCookie(res, refreshToken);

  return sendSuccess(res, 201, 'Registration successful. Please verify your email.', {
    user,
    store,
    accessToken,
    emailVerification,
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, store, accessToken, refreshToken } = await authService.loginUser(
    req.body.email,
    req.body.password
  );

  setRefreshTokenCookie(res, refreshToken);

  return sendSuccess(res, 200, 'Login successful', {
    user,
    store,
    accessToken,
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);
  clearRefreshTokenCookie(res);

  return sendSuccess(res, 200, 'Logout successful');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);

  const responseData = {};

  // Expose token in development only (replace with email in production)
  if (process.env.NODE_ENV !== 'production' && result.resetToken) {
    responseData.resetToken = result.resetToken;
    responseData.note = 'Reset token included for development testing only';
  }

  return sendSuccess(
    res,
    200,
    'If an account exists with that email, a password reset link has been sent',
    Object.keys(responseData).length ? responseData : undefined
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.resetPassword(
    req.body.token,
    req.body.password
  );

  setRefreshTokenCookie(res, refreshToken);

  return sendSuccess(res, 200, 'Password reset successful', {
    user,
    accessToken,
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getUserProfile(req.user._id);

  return sendSuccess(res, 200, 'Profile retrieved successfully', { user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateUserProfile(req.user._id, req.body);

  return sendSuccess(res, 200, 'Profile updated successfully', { user });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    throw new ApiError(401, 'Refresh token required');
  }

  const user = await authService.validateRefreshToken(token);
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  setRefreshTokenCookie(res, refreshToken);

  return sendSuccess(res, 200, 'Token refreshed', {
    accessToken,
    user: sanitizeUser(user),
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailOtp(req.user._id, req.body.otp);

  return sendSuccess(
    res,
    200,
    result.alreadyVerified ? 'Email already verified' : 'Email verified successfully',
    { user: result.user }
  );
});

export const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendEmailVerification(req.user._id);

  if (result.alreadyVerified) {
    return sendSuccess(res, 200, 'Email already verified', {
      user: result.user,
      alreadyVerified: true,
    });
  }

  return sendSuccess(res, 200, 'A new verification code has been sent', {
    user: result.user,
    expiresInSeconds: result.expiresInSeconds,
    resendAvailableInSeconds: result.resendAvailableInSeconds,
    ...(result.otp ? { otp: result.otp, note: 'OTP included for development testing only' } : {}),
  });
});
