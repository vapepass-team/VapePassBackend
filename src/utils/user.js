/**
 * Strip sensitive fields from a Mongoose user document.
 */
export const sanitizeUser = (user) => {
  if (!user) return null;

  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.refreshToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationOTP;
  delete obj.emailVerificationExpires;
  delete obj.emailVerificationAttempts;
  delete obj.emailVerificationLastSentAt;
  delete obj.__v;

  return obj;
};
