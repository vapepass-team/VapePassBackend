import User from '../models/User.js';
import Store from '../models/Store.js';
import { ApiError, ROLES, SUBSCRIPTION_PLANS } from '../utils/constants.js';
import { extractHostname } from '../utils/domain.js';
import { generateResetToken, generateOtp, hashToken } from '../utils/token.js';
import { sanitizeUser } from '../utils/user.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from './token.service.js';
import { sendPasswordResetEmail, sendEmailVerificationOtp } from './email.service.js';

const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const EMAIL_OTP_MAX_ATTEMPTS = 5;

function normalizeWebsiteUrl(rawUrl) {
  if (!rawUrl) return null;
  let url = String(rawUrl).trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    return new URL(url).toString();
  } catch {
    throw new ApiError(400, 'Please provide a valid website URL');
  }
}

function splitOwnerName(ownerName, firstName, lastName) {
  if (firstName && lastName) {
    return { firstName: firstName.trim(), lastName: lastName.trim() };
  }

  const parts = String(ownerName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Owner' };
  }

  return { firstName: firstName || 'Store', lastName: lastName || 'Owner' };
}

export const registerUser = async ({
  firstName,
  lastName,
  ownerName,
  email,
  password,
  phone,
  role = ROLES.STORE_OWNER,
  storeName,
  websiteUrl,
  productPageUrl,
  country,
  province,
  city,
  address,
  subscriptionPlan,
}) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  if (role === ROLES.EMPLOYEE) {
    throw new ApiError(400, 'Employees must be invited by a store owner');
  }

  if (role === ROLES.ADMIN) {
    throw new ApiError(403, 'Admin accounts cannot be created via public registration');
  }

  const names = splitOwnerName(ownerName, firstName, lastName);
  const website = normalizeWebsiteUrl(websiteUrl || productPageUrl);

  if (!website) {
    throw new ApiError(400, 'Website URL is required');
  }

  if (!storeName?.trim()) {
    throw new ApiError(400, 'Store name is required');
  }

  const user = await User.create({
    firstName: names.firstName,
    lastName: names.lastName,
    email,
    phone: phone || null,
    password,
    role: ROLES.STORE_OWNER,
    emailVerified: false,
  });

  const store = await Store.create({
    name: storeName.trim(),
    createdBy: user._id,
    websiteUrl: website,
    productPageUrl: website,
    allowedHostname: extractHostname(website),
    country: country || 'CA',
    province: province || null,
    city: city || null,
    address: address || null,
    subscriptionPlan: subscriptionPlan || SUBSCRIPTION_PLANS.PRO,
    inventorySyncStatus: 'idle',
  });

  user.storeId = store._id;
  await user.save();

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const verification = await issueEmailVerificationOtp(user, { force: true });

  return {
    user: sanitizeUser(user),
    store,
    accessToken,
    refreshToken,
    emailVerification: {
      sent: true,
      expiresInSeconds: Math.floor(EMAIL_OTP_TTL_MS / 1000),
      resendAvailableInSeconds: Math.floor(EMAIL_OTP_RESEND_COOLDOWN_MS / 1000),
      ...(verification.devOtp ? { otp: verification.devOtp } : {}),
    },
  };
};

export const loginUser = async (email, password) => {
  const user = await User.findOne({ email }).select('+password +refreshToken');

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact support.');
  }

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  // Include store so clients can route on DB subscriptionStatus after login
  let store = null;
  if (user.storeId) {
    store = await Store.findById(user.storeId);
  }

  return {
    user: sanitizeUser(user),
    store,
    accessToken,
    refreshToken,
  };
};

export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

export const getUserProfile = async (userId) => {
  const user = await User.findById(userId).populate('storeId');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return sanitizeUser(user);
};

export const updateUserProfile = async (userId, updates = {}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (updates.firstName !== undefined) user.firstName = String(updates.firstName).trim();
  if (updates.lastName !== undefined) user.lastName = String(updates.lastName).trim();
  if (updates.phone !== undefined) {
    const phone = String(updates.phone || '').trim();
    user.phone = phone || null;
  }

  await user.save();
  return sanitizeUser(user);
};

export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return { resetToken: null };
  }

  const { resetToken, hashedToken } = generateResetToken();

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    console.error(`[email] Failed to send password reset to ${user.email}:`, error.message);
  }

  return { resetToken, email: user.email };
};

export const resetPassword = async (token, newPassword) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new ApiError(400, 'Password reset token is invalid or has expired');
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined;
  await user.save();

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

export const validateRefreshToken = async (token) => {
  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    return user;
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
};

async function loadUserForEmailVerification(userId) {
  const user = await User.findById(userId).select(
    '+emailVerificationOTP +emailVerificationExpires +emailVerificationAttempts +emailVerificationLastSentAt'
  );

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
}

async function issueEmailVerificationOtp(user, { force = false } = {}) {
  if (user.emailVerified) {
    return {
      alreadyVerified: true,
      resendAvailableInSeconds: 0,
    };
  }

  const now = Date.now();
  if (!force && user.emailVerificationLastSentAt) {
    const elapsed = now - new Date(user.emailVerificationLastSentAt).getTime();
    if (elapsed < EMAIL_OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new ApiError(
        429,
        `Please wait ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before requesting a new code`
      );
    }
  }

  const { otp, hashedOtp } = generateOtp(6);

  user.emailVerificationOTP = hashedOtp;
  user.emailVerificationExpires = new Date(now + EMAIL_OTP_TTL_MS);
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date(now);
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmailVerificationOtp(user.email, otp);
  } catch (error) {
    console.error(`[email] Failed to send verification OTP to ${user.email}:`, error.message);
  }

  return {
    alreadyVerified: false,
    expiresInSeconds: Math.floor(EMAIL_OTP_TTL_MS / 1000),
    resendAvailableInSeconds: Math.floor(EMAIL_OTP_RESEND_COOLDOWN_MS / 1000),
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  };
}

export const resendEmailVerification = async (userId) => {
  const user = await loadUserForEmailVerification(userId);

  if (user.emailVerified) {
    return {
      alreadyVerified: true,
      user: sanitizeUser(user),
      resendAvailableInSeconds: 0,
    };
  }

  const result = await issueEmailVerificationOtp(user);

  return {
    alreadyVerified: false,
    user: sanitizeUser(user),
    expiresInSeconds: result.expiresInSeconds,
    resendAvailableInSeconds: result.resendAvailableInSeconds,
    ...(result.devOtp ? { otp: result.devOtp } : {}),
  };
};

export const verifyEmailOtp = async (userId, rawOtp) => {
  const otp = String(rawOtp || '').trim();

  if (!/^\d{6}$/.test(otp)) {
    throw new ApiError(400, 'Enter the 6-digit verification code');
  }

  const user = await loadUserForEmailVerification(userId);

  if (user.emailVerified) {
    return { user: sanitizeUser(user), alreadyVerified: true };
  }

  if (!user.emailVerificationOTP || !user.emailVerificationExpires) {
    throw new ApiError(400, 'No verification code found. Request a new code.');
  }

  if (new Date(user.emailVerificationExpires).getTime() <= Date.now()) {
    user.emailVerificationOTP = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, 'Verification code expired. Request a new code.');
  }

  if ((user.emailVerificationAttempts || 0) >= EMAIL_OTP_MAX_ATTEMPTS) {
    user.emailVerificationOTP = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(429, 'Too many invalid attempts. Request a new code.');
  }

  const hashed = hashToken(otp);
  if (hashed !== user.emailVerificationOTP) {
    user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
    const remaining = EMAIL_OTP_MAX_ATTEMPTS - user.emailVerificationAttempts;
    await user.save({ validateBeforeSave: false });

    if (remaining <= 0) {
      user.emailVerificationOTP = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save({ validateBeforeSave: false });
      throw new ApiError(429, 'Too many invalid attempts. Request a new code.');
    }

    throw new ApiError(
      400,
      `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    );
  }

  user.emailVerified = true;
  user.emailVerificationOTP = undefined;
  user.emailVerificationExpires = undefined;
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = undefined;
  await user.save({ validateBeforeSave: false });

  return { user: sanitizeUser(user), alreadyVerified: false };
};

