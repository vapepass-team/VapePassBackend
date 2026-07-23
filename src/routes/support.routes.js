import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  createSetupRequestValidator,
  createContactLeadValidator,
} from '../validators/support.validator.js';
import * as supportController from '../controllers/support.controller.js';

const router = Router();

/**
 * POST /api/v1/support/setup-request
 * Authenticated store owners/employees submit Free Setup Assistance requests.
 */
router.post(
  '/setup-request',
  authenticateUser,
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  validate(createSetupRequestValidator),
  supportController.createSetupRequest
);

/**
 * POST /api/v1/support/contact
 * Public pricing Contact Us form (no auth).
 */
router.post(
  '/contact',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 8 }),
  validate(createContactLeadValidator),
  supportController.createContactLead
);

export default router;
