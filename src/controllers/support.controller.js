import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as supportService from '../services/support.service.js';

export const createSetupRequest = asyncHandler(async (req, res) => {
  const data = await supportService.createSetupAssistanceRequest(req.body, req.user);
  return sendSuccess(res, 201, 'Setup request submitted successfully', data);
});

export const createContactLead = asyncHandler(async (req, res) => {
  const data = await supportService.createContactLead(req.body);
  return sendSuccess(res, 201, 'Thanks! We received your inquiry and will contact you shortly.', data);
});
