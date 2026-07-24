import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../utils/constants.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: [40, 'Phone number cannot exceed 40 characters'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.STORE_OWNER,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    /** Existing accounts default verified; new registrations set false explicitly */
    emailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerificationOTP: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    emailVerificationLastSentAt: {
      type: Date,
      select: false,
    },
    /** Set once the post-verification welcome email has been delivered */
    welcomeEmailSentAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetOTP: {
      type: String,
      select: false,
    },
    passwordResetOTPExpires: {
      type: Date,
      select: false,
    },
    passwordResetOTPAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetOTPLastSentAt: {
      type: Date,
      select: false,
    },
    passwordChangeOTP: {
      type: String,
      select: false,
    },
    passwordChangeOTPExpires: {
      type: Date,
      select: false,
    },
    passwordChangeOTPAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordChangeOTPLastSentAt: {
      type: Date,
      select: false,
    },
    /** Already-hashed replacement password, applied only after OTP confirmation */
    pendingPasswordHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

userSchema.index({ storeId: 1 });

// Hash password before saving
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
