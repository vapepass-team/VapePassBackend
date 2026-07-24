import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator,
  verifyEmailValidator,
  verifyPasswordResetOtpValidator,
  requestPasswordChangeValidator,
  confirmPasswordChangeValidator,
} from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

/** Throttle OTP issuance so codes cannot be used to spam inboxes */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many verification code requests. Please try again later.',
});

/** Throttle OTP submissions as a second layer over per-code attempt limits */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Too many verification attempts. Please try again later.',
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new store owner account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         store:
 *                           $ref: '#/components/schemas/Store'
 *                         accessToken:
 *                           type: string
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/register', validate(registerValidator), authController.register);

/**
*  @swagger
*  /auth/login:
*    post:
*      summary: Log in with email and password
*      tags: [Auth]
*      requestBody:
*        required: true
*        content:
*          application/json:
*            schema:
*              $ref: '#/components/schemas/LoginInput'
*      responses:
*        200:
*          description: Login successful
*          headers:
*            Set-Cookie:
*              description: HTTP-only refresh token cookie
*              schema:
*                type: string
*          content:
*            application/json:
*              schema:
*                allOf:
*                  - $ref: '#/components/schemas/ApiResponse'
*                  - type: object
*                    properties:
*                      data:
*                        type: object
*                        properties:
*                          user:
*                            $ref: '#/components/schemas/User'
*                          accessToken:
*                            type: string
*        401:
*         description: Invalid credentials
*/ 
router.post('/login', validate(loginValidator), authController.login);

router.post(
  '/verify-email',
  authenticateUser,
  otpVerifyLimiter,
  validate(verifyEmailValidator),
  authController.verifyEmail
);

router.post(
  '/resend-verification',
  authenticateUser,
  otpRequestLimiter,
  authController.resendVerification
);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Start a password change (sends a confirmation OTP)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification code sent
 */
router.post(
  '/change-password',
  authenticateUser,
  otpRequestLimiter,
  validate(requestPasswordChangeValidator),
  authController.requestPasswordChange
);

/**
 * @swagger
 * /auth/change-password/confirm:
 *   post:
 *     summary: Confirm a password change with the emailed OTP
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password updated
 */
router.post(
  '/change-password/confirm',
  authenticateUser,
  otpVerifyLimiter,
  validate(confirmPasswordChangeValidator),
  authController.confirmPasswordChange
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out and clear refresh token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateUser, authController.logout);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Send a password reset OTP to a registered email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset code sent if account exists
 */
router.post(
  '/forgot-password',
  otpRequestLimiter,
  validate(forgotPasswordValidator),
  authController.forgotPassword
);

/**
 * @swagger
 * /auth/forgot-password/verify:
 *   post:
 *     summary: Exchange a valid reset OTP for a single-use reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset token issued
 */
router.post(
  '/forgot-password/verify',
  otpVerifyLimiter,
  validate(verifyPasswordResetOtpValidator),
  authController.verifyPasswordResetOtp
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post(
  '/reset-password',
  validate(resetPasswordValidator),
  authController.resetPassword
);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 */
router.get('/profile', authenticateUser, authController.getProfile);

router.patch(
  '/profile',
  authenticateUser,
  validate(updateProfileValidator),
  authController.updateProfile
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using HTTP-only refresh cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Refresh token missing or invalid
 */
router.post('/refresh', authController.refresh);

export default router;
