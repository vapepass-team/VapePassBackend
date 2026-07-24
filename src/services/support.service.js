import SetupRequest from '../models/SetupRequest.js';
import ContactLead from '../models/ContactLead.js';
import Store from '../models/Store.js';
import {
  ApiError,
  CONTACT_LEAD_STATUS,
  SETUP_REQUEST_STATUS,
  SUPPORT_REQUEST_SOURCES,
} from '../utils/constants.js';
import {
  getSupportAdminEmail,
  sendSetupRequestAdminEmail,
  sendSetupRequestCustomerEmail,
  sendContactLeadAdminEmail,
  sendContactLeadCustomerEmail,
} from './email.service.js';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function dispatchSetupRequestEmails(doc) {
  const adminTo = getSupportAdminEmail();
  const emailPayload = {
    customerName: doc.fullName,
    storeName: doc.storeName,
    email: doc.email,
    phone: doc.phone,
    websiteUrl: doc.websiteUrl,
    message: doc.message,
    submittedAt: doc.createdAt,
    source: doc.source || SUPPORT_REQUEST_SOURCES.REQUEST_ASSISTANCE,
  };

  if (!adminTo) {
    console.error(
      '[support] SUPPORT_ADMIN_EMAIL is not configured on this host — admin notification skipped'
    );
  }

  const [customerMail, adminMail] = await Promise.all([
    sendSetupRequestCustomerEmail(doc.email, emailPayload),
    adminTo
      ? sendSetupRequestAdminEmail(adminTo, emailPayload)
      : Promise.resolve({ sent: false, error: 'SUPPORT_ADMIN_EMAIL not configured' }),
  ]);

  const updates = {};
  if (customerMail?.sent) updates.customerEmailSentAt = new Date();
  if (adminMail?.sent) updates.adminEmailSentAt = new Date();
  if (Object.keys(updates).length) {
    await SetupRequest.updateOne({ _id: doc._id }, { $set: updates });
  }

  console.info(
    `[support] Setup request ${doc._id} emails — customer: ${
      customerMail?.sent
        ? 'sent'
        : customerMail?.devFallback
          ? 'dev-fallback'
          : `failed (${customerMail?.error || 'unknown'})`
    }, admin (${adminTo || 'n/a'}): ${
      adminMail?.sent
        ? 'sent'
        : adminMail?.devFallback
          ? 'dev-fallback'
          : `failed (${adminMail?.error || 'unknown'})`
    }`
  );

  return {
    customerEmailSent: Boolean(customerMail?.sent || customerMail?.devFallback),
    adminEmailSent: Boolean(adminMail?.sent || adminMail?.devFallback),
  };
}

/**
 * Queue emails after the HTTP response path — do not block the client on SMTP.
 */
function queueSetupRequestEmails(doc) {
  setImmediate(() => {
    dispatchSetupRequestEmails(doc).catch((err) => {
      console.error(`[support] Background email dispatch failed for ${doc._id}:`, err.message);
    });
  });
}

/**
 * Create a free setup assistance request and return immediately after DB save.
 * Emails are sent in the background so production SMTP latency does not freeze the UI.
 */
export async function createSetupAssistanceRequest(payload, user) {
  const email = String(payload.email || '').trim().toLowerCase();
  const storeId = user?.storeId || null;
  const userId = user?._id || null;

  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const duplicateFilter = {
    status: {
      $in: [
        SETUP_REQUEST_STATUS.PENDING,
        SETUP_REQUEST_STATUS.CONTACTED,
        SETUP_REQUEST_STATUS.SCHEDULED,
      ],
    },
    createdAt: { $gte: since },
    $or: [{ email }],
  };

  if (userId) duplicateFilter.$or.push({ userId });
  if (storeId) duplicateFilter.$or.push({ storeId });

  const existing = await SetupRequest.findOne(duplicateFilter);

  // Prior request exists but admin email never confirmed — retry in background.
  if (existing && !existing.adminEmailSentAt) {
    queueSetupRequestEmails(existing);
    return {
      requestId: String(existing._id),
      status: existing.status,
      customerEmailSent: null,
      adminEmailSent: null,
      queued: true,
      resent: true,
    };
  }

  if (existing) {
    throw new ApiError(
      409,
      'You already have an open setup request. Our team will contact you during business hours.'
    );
  }

  let subscriptionId = null;
  if (storeId) {
    const store = await Store.findById(storeId).select('stripeSubscriptionId').lean();
    subscriptionId = store?.stripeSubscriptionId || null;
  }

  const doc = await SetupRequest.create({
    fullName: payload.name,
    storeName: payload.storeName,
    email,
    phone: payload.phone,
    websiteUrl: payload.websiteUrl,
    message: payload.message || '',
    userId,
    storeId,
    subscriptionId,
    source:
      payload.source === SUPPORT_REQUEST_SOURCES.NEED_HELP
        ? SUPPORT_REQUEST_SOURCES.NEED_HELP
        : SUPPORT_REQUEST_SOURCES.REQUEST_ASSISTANCE,
    status: SETUP_REQUEST_STATUS.PENDING,
  });

  queueSetupRequestEmails(doc);

  return {
    requestId: String(doc._id),
    status: doc.status,
    customerEmailSent: null,
    adminEmailSent: null,
    queued: true,
  };
}

export async function listSetupRequests({ page = 1, limit = 20, status } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;

  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    SetupRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SetupRequest.countDocuments(filter),
  ]);

  const requests = rows.map((row) => ({
    id: row._id,
    fullName: row.fullName,
    storeName: row.storeName,
    email: row.email,
    phone: row.phone,
    websiteUrl: row.websiteUrl,
    message: row.message || '',
    status: row.status,
    userId: row.userId,
    storeId: row.storeId,
    subscriptionId: row.subscriptionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return {
    requests,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function updateSetupRequestStatus(requestId, status) {
  const doc = await SetupRequest.findByIdAndUpdate(
    requestId,
    { $set: { status } },
    { new: true }
  ).lean();

  if (!doc) return null;

  return {
    id: doc._id,
    fullName: doc.fullName,
    storeName: doc.storeName,
    email: doc.email,
    phone: doc.phone,
    websiteUrl: doc.websiteUrl,
    message: doc.message || '',
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function dispatchContactLeadEmails(doc) {
  const adminTo = getSupportAdminEmail();
  const emailPayload = {
    ownerName: doc.ownerName,
    storeName: doc.storeName,
    email: doc.email,
    phone: doc.phone,
    startDate: doc.startDate,
    message: doc.message,
    submittedAt: doc.createdAt,
  };

  if (!adminTo) {
    console.error(
      '[support] SUPPORT_ADMIN_EMAIL is not configured — contact lead admin email skipped'
    );
  }

  const [customerMail, adminMail] = await Promise.all([
    sendContactLeadCustomerEmail(doc.email, emailPayload),
    adminTo
      ? sendContactLeadAdminEmail(adminTo, emailPayload)
      : Promise.resolve({ sent: false, error: 'SUPPORT_ADMIN_EMAIL not configured' }),
  ]);

  const updates = {};
  if (customerMail?.sent) updates.customerEmailSentAt = new Date();
  if (adminMail?.sent) updates.adminEmailSentAt = new Date();
  if (Object.keys(updates).length) {
    await ContactLead.updateOne({ _id: doc._id }, { $set: updates });
  }

  console.info(
    `[support] Contact lead ${doc._id} emails — customer: ${
      customerMail?.sent
        ? 'sent'
        : customerMail?.devFallback
          ? 'dev-fallback'
          : `failed (${customerMail?.error || 'unknown'})`
    }, admin (${adminTo || 'n/a'}): ${
      adminMail?.sent
        ? 'sent'
        : adminMail?.devFallback
          ? 'dev-fallback'
          : `failed (${adminMail?.error || 'unknown'})`
    }`
  );

  return {
    customerEmailSent: Boolean(customerMail?.sent || customerMail?.devFallback),
    adminEmailSent: Boolean(adminMail?.sent || adminMail?.devFallback),
  };
}

function queueContactLeadEmails(doc) {
  setImmediate(() => {
    dispatchContactLeadEmails(doc).catch((err) => {
      console.error(`[support] Contact lead email dispatch failed for ${doc._id}:`, err.message);
    });
  });
}

/**
 * Public pricing Contact Us lead — saved to MongoDB, emails queued in background.
 */
export async function createContactLead(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = String(payload.phone || '').trim();
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const existing = await ContactLead.findOne({
    status: CONTACT_LEAD_STATUS.NEW,
    createdAt: { $gte: since },
    $or: [{ email }, { phone }],
  });

  if (existing && !existing.adminEmailSentAt) {
    queueContactLeadEmails(existing);
    return {
      leadId: String(existing._id),
      status: existing.status,
      queued: true,
      resent: true,
    };
  }

  if (existing) {
    throw new ApiError(
      409,
      'We already received your inquiry. Our team will contact you shortly.'
    );
  }

  let startDate = null;
  if (payload.startDate) {
    const parsed = new Date(payload.startDate);
    if (!Number.isNaN(parsed.getTime())) startDate = parsed;
  }

  const doc = await ContactLead.create({
    storeName: payload.storeName,
    ownerName: payload.ownerName,
    email,
    phone,
    startDate,
    message: payload.message || '',
    status: CONTACT_LEAD_STATUS.NEW,
    source: 'pricing',
  });

  queueContactLeadEmails(doc);

  return {
    leadId: String(doc._id),
    status: doc.status,
    queued: true,
  };
}
