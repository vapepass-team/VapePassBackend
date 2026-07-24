import crypto from 'crypto';

export const generateResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  return { resetToken, hashedToken };
};

export const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

/** Cryptographically secure numeric OTP (default 6 digits). */
export const generateOtp = (length = 6) => {
  const digits = Math.max(4, Math.min(8, Number(length) || 6));
  const max = 10 ** digits;
  const otp = crypto.randomInt(0, max).toString().padStart(digits, '0');
  return { otp, hashedOtp: hashToken(otp) };
};
