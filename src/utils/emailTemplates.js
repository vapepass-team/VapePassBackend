/**
 * Shared HTML email layout for VapePass transactional emails.
 */

import { env } from '../config/env.js';

const BRAND = {
  purple: '#7c3aed',
  ink: '#0c0c12',
  muted: '#5c5c6d',
  light: '#9494a6',
  border: '#e5e7eb',
  bg: '#f8f7fc',
};

/**
 * Only use remote images when they are publicly reachable over HTTPS.
 * localhost / API_PUBLIC_URL / SVG files break in Gmail and most clients.
 */
function getPublicLogoUrl() {
  const configured = String(env.email?.logoUrl || '').trim();
  if (/^https:\/\//i.test(configured)) return configured;
  return null;
}

/** Inline HTML logo — never depends on remote image hosting */
function buildInlineLogoHtml() {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
      <tr>
        <td style="width:42px;height:42px;background:#ffffff;border-radius:11px;text-align:center;vertical-align:middle;">
          <span style="display:inline-block;color:${BRAND.purple};font-size:22px;line-height:42px;font-weight:700;">✦</span>
        </td>
        <td style="padding-left:12px;text-align:left;">
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;line-height:1.1;">VapePass</div>
        </td>
      </tr>
    </table>
  `;
}

function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientUrl() {
  return String(env.clientUrl || '').replace(/\/+$/, '');
}

/** Support + documentation destinations shown in every email footer */
function getSupportLinks() {
  const client = getClientUrl();
  return {
    supportEmail: String(env.email?.supportContact || '').trim(),
    docsUrl: String(env.links?.docsUrl || '').trim() || `${client}/docs`,
    supportUrl: String(env.links?.supportUrl || '').trim() || `${client}/contact`,
    dashboardUrl: `${client}/dashboard`,
    settingsUrl: `${client}/settings`,
  };
}

/** Shared CTA button markup so every email uses one button style */
function buildButtonHtml(label, url) {
  if (!url) return '';
  return `
    <p style="margin:24px 0 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.purple};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:9999px;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
    </p>
  `;
}

/** Shared large-code block used by every OTP email */
function buildOtpBlockHtml(code) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;margin:24px 0;">
      <tr>
        <td style="padding:22px;text-align:center;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.light};margin-bottom:8px;">Verification code</div>
          <div style="font-size:32px;font-weight:700;letter-spacing:0.32em;color:${BRAND.ink};">${escapeHtml(code)}</div>
        </td>
      </tr>
    </table>
  `;
}

/** Key/value detail table shared by notification emails */
function buildDetailTableHtml(rows) {
  const cells = rows
    .filter((row) => row && row.label)
    .map(
      (row, index) => `
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};${index === 0 ? '' : `border-top:1px solid ${BRAND.border};`}">${escapeHtml(row.label)}<br/><strong style="color:${BRAND.ink};${row.wrap ? 'word-break:break-all;' : ''}${row.preserveLines ? 'white-space:pre-wrap;' : ''}">${escapeHtml(row.value ?? '—') || '—'}</strong></td></tr>
      `
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;">
      ${cells}
    </table>
  `;
}

function formatMoney(amount, currency = 'USD') {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/**
 * @param {{ title: string, bodyHtml: string, preheader?: string, internal?: boolean }} options
 */
export function wrapEmailLayout({ title, bodyHtml, preheader = '', internal = false }) {
  const publicLogoUrl = getPublicLogoUrl();
  const logoBlock = publicLogoUrl
    ? `<img src="${publicLogoUrl}" width="160" alt="VapePass" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;max-width:160px;height:auto;" />`
    : buildInlineLogoHtml();

  const links = getSupportLinks();
  const footerLinks = internal
    ? ''
    : `
              <p style="margin:0 0 10px;font-size:12px;color:${BRAND.light};line-height:1.6;">
                <a href="${links.docsUrl}" style="color:${BRAND.purple};text-decoration:none;">Documentation</a>
                &nbsp;•&nbsp;
                <a href="${links.supportUrl}" style="color:${BRAND.purple};text-decoration:none;">Support</a>
                ${links.supportEmail ? `&nbsp;•&nbsp;<a href="mailto:${links.supportEmail}" style="color:${BRAND.purple};text-decoration:none;">${links.supportEmail}</a>` : ''}
              </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Inter,Segoe UI,system-ui,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
          <tr>
            <td style="background:${BRAND.purple};padding:28px 32px;text-align:center;">
              ${logoBlock}
              <div style="margin-top:4px;font-size:13px;color:rgba(255,255,255,0.85);">${title}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
              <p style="margin:32px 0 0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
                Regards,<br />
                <strong style="color:${BRAND.ink};">Team VapePass</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid ${BRAND.border};text-align:center;">
              ${footerLinks}
              <p style="margin:0;font-size:12px;color:${BRAND.light};line-height:1.5;">
                © ${new Date().getFullYear()} VapePass. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Human label for a stored subscription plan key */
function formatPlanLabel(plan) {
  const key = String(plan || '').trim();
  if (!key) return 'Pro';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function buildSubscriptionActivatedEmail({
  storeName,
  startDate,
  endDate,
  plan,
  nextBillingDate,
  autoRenew = true,
}) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const nextBilling = formatDate(nextBillingDate || endDate);
  const planLabel = formatPlanLabel(plan);
  const links = getSupportLinks();
  const autoRenewLabel = autoRenew ? 'Enabled' : 'Disabled';

  const subject = 'Your VapePass Subscription Is Activated';
  const text = [
    'Subscription successfully activated',
    '',
    `Store Name: ${storeName || 'Your store'}`,
    `Subscription Plan: ${planLabel}`,
    `Activation Date: ${start}`,
    `Expiration Date: ${end}`,
    `Next Billing Date: ${nextBilling}`,
    `Auto-Renewal: ${autoRenewLabel}`,
    '',
    autoRenew
      ? 'Auto-renewal is currently enabled, so your subscription renews automatically on the next billing date.'
      : 'Auto-renewal is currently disabled, so your subscription will end on the expiration date.',
    `You can turn auto-renewal on or off at any time from Settings → Billing: ${links.settingsUrl}`,
    '',
    'Your dashboard and embedding script are now unlocked.',
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Subscription Activated',
    preheader: 'Your VapePass subscription is now active.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Subscription successfully activated</h1>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Thank you for subscribing to VapePass. Your store dashboard is unlocked and your secure embedding script is ready to install.
      </p>
      ${buildDetailTableHtml([
        { label: 'Store Name', value: storeName || 'Your store' },
        { label: 'Subscription Plan', value: planLabel },
        { label: 'Activation Date', value: start },
        { label: 'Expiration Date', value: end },
        { label: 'Next Billing Date', value: nextBilling },
        { label: 'Auto-Renewal', value: autoRenewLabel },
      ])}
      <p style="margin:20px 0 0;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        ${
          autoRenew
            ? 'Auto-renewal is currently <strong style="color:' +
              BRAND.ink +
              ';">enabled</strong>, so your subscription renews automatically on the next billing date.'
            : 'Auto-renewal is currently <strong style="color:' +
              BRAND.ink +
              ';">disabled</strong>, so your subscription will end on the expiration date.'
        }
        You can change this at any time from <strong style="color:${BRAND.ink};">Settings → Billing</strong>.
      </p>
      ${buildButtonHtml('Open Settings', links.settingsUrl)}
    `,
  });

  return { subject, text, html };
}

/**
 * Internal notification sent to administrators once a payment succeeds
 * and a store subscription becomes active.
 */
export function buildSubscriptionActivatedAdminEmail({
  ownerName,
  storeName,
  storeUrl,
  email,
  phone,
  plan,
  activationDate,
}) {
  const activated = formatDateTime(activationDate || new Date());
  const planLabel = formatPlanLabel(plan);
  const subject = `New Subscription Activated – ${storeName || 'VapePass store'}`;

  const text = [
    'New subscription activated',
    '',
    `Owner Name: ${ownerName || '—'}`,
    `Store Name: ${storeName || '—'}`,
    `Store URL: ${storeUrl || '—'}`,
    `Email Address: ${email || '—'}`,
    `Phone Number: ${phone || '—'}`,
    `Subscription Plan: ${planLabel}`,
    `Activation Date: ${activated}`,
    '',
    'Payment has been completed successfully and the store dashboard is now unlocked.',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'New Subscription Activated',
    preheader: `${storeName || 'A store'} activated a VapePass subscription.`,
    internal: true,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">New subscription activated</h1>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Payment completed successfully. The store dashboard is now unlocked.
      </p>
      ${buildDetailTableHtml([
        { label: 'Owner Name', value: ownerName },
        { label: 'Store Name', value: storeName },
        { label: 'Store URL', value: storeUrl, wrap: true },
        { label: 'Email Address', value: email },
        { label: 'Phone Number', value: phone },
        { label: 'Subscription Plan', value: planLabel },
        { label: 'Activation Date', value: activated },
      ])}
    `,
  });

  return { subject, text, html };
}

/**
 * Account confirmation OTP sent during registration.
 */
export function buildEmailVerificationEmail({ otp, expiresInMinutes = 10 }) {
  const subject = 'Verify your VapePass email';
  const text = [
    'Confirm your VapePass account',
    '',
    `Your verification code is: ${otp}`,
    '',
    `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not create a VapePass account, you can safely ignore this email.',
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Confirm your email',
    preheader: 'Your VapePass verification code.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Confirm your email address</h1>
      <p style="margin:0 0 4px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Welcome to VapePass. Enter the code below to verify your email and continue setting up your store.
      </p>
      ${buildOtpBlockHtml(otp)}
      <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
        This code expires in ${expiresInMinutes} minutes and can only be used once.
        If you did not create a VapePass account, you can safely ignore this email.
      </p>
    `,
  });

  return { subject, text, html };
}

/**
 * Welcome email sent once the email address is verified.
 */
export function buildWelcomeEmail({ ownerName, storeName }) {
  const links = getSupportLinks();
  const safeName = escapeHtml(ownerName || 'there');
  const safeStore = escapeHtml(storeName || 'your store');
  const subject = `Welcome to VapePass, ${storeName || 'retailer'}!`;

  const text = [
    `Hello ${ownerName || 'there'},`,
    '',
    `Welcome to VapePass — ${storeName || 'your store'} is now confirmed.`,
    '',
    'VapePass gives your customers an AI shopping assistant trained on your live inventory,',
    'with age verification and region-aware compliance built in.',
    '',
    'Getting started:',
    '1. Activate your subscription to unlock the dashboard.',
    '2. Add your store details and product page URL in Settings.',
    '3. Sync your inventory so the assistant learns your catalogue.',
    '4. Copy your embed script and paste it into your website.',
    '',
    `Documentation: ${links.docsUrl}`,
    `Support: ${links.supportUrl}`,
    links.supportEmail ? `Email us: ${links.supportEmail}` : '',
    '',
    'Regards,',
    'Team VapePass',
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapEmailLayout({
    title: 'Welcome to VapePass',
    preheader: `${storeName || 'Your store'} is confirmed — here's how to get started.`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Welcome to VapePass</h1>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Hello ${safeName}, your email is verified and <strong style="color:${BRAND.ink};">${safeStore}</strong> is ready to go.
      </p>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        VapePass gives your customers an AI shopping assistant trained on your live inventory, with age verification
        and region-aware compliance built in.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;">
        <tr>
          <td style="padding:20px 22px;">
            <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.light};margin-bottom:12px;">Getting started</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr><td style="padding:0 0 10px;font-size:14px;color:${BRAND.muted};line-height:1.6;"><strong style="color:${BRAND.ink};">1.</strong> Activate your subscription to unlock the dashboard.</td></tr>
              <tr><td style="padding:0 0 10px;font-size:14px;color:${BRAND.muted};line-height:1.6;"><strong style="color:${BRAND.ink};">2.</strong> Add your store details and product page URL in Settings.</td></tr>
              <tr><td style="padding:0 0 10px;font-size:14px;color:${BRAND.muted};line-height:1.6;"><strong style="color:${BRAND.ink};">3.</strong> Sync your inventory so the assistant learns your catalogue.</td></tr>
              <tr><td style="padding:0;font-size:14px;color:${BRAND.muted};line-height:1.6;"><strong style="color:${BRAND.ink};">4.</strong> Copy your embed script and paste it into your website.</td></tr>
            </table>
          </td>
        </tr>
      </table>
      ${buildButtonHtml('Go to your dashboard', links.dashboardUrl)}
      <p style="margin:20px 0 0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
        Need a hand? Read the <a href="${links.docsUrl}" style="color:${BRAND.purple};text-decoration:none;">documentation</a>
        or <a href="${links.supportUrl}" style="color:${BRAND.purple};text-decoration:none;">contact support</a>${
          links.supportEmail
            ? ` at <a href="mailto:${links.supportEmail}" style="color:${BRAND.purple};text-decoration:none;">${links.supportEmail}</a>`
            : ''
        }. We also offer free setup assistance from the dashboard.
      </p>
    `,
  });

  return { subject, text, html };
}

/**
 * OTP email for the forgot-password flow.
 */
export function buildPasswordResetOtpEmail({ otp, expiresInMinutes = 10 }) {
  const subject = 'Your VapePass password reset code';
  const text = [
    'Password reset requested',
    '',
    `Your password reset code is: ${otp}`,
    '',
    `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not request a password reset, you can safely ignore this email — your password stays unchanged.',
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Password Reset Code',
    preheader: 'Your VapePass password reset code.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Reset your password</h1>
      <p style="margin:0 0 4px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Enter the code below to confirm it's you, then choose a new password.
      </p>
      ${buildOtpBlockHtml(otp)}
      <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
        This code expires in ${expiresInMinutes} minutes and can only be used once.
        If you did not request a password reset, you can safely ignore this email — your password stays unchanged.
      </p>
    `,
  });

  return { subject, text, html };
}

/**
 * OTP email confirming a password change started from Settings.
 */
export function buildPasswordChangeOtpEmail({ otp, expiresInMinutes = 10 }) {
  const links = getSupportLinks();
  const subject = 'Confirm your VapePass password change';
  const text = [
    'Password change requested',
    '',
    `Your confirmation code is: ${otp}`,
    '',
    `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not request this change, do not share the code and contact support immediately.',
    links.supportEmail ? `Support: ${links.supportEmail}` : '',
    '',
    'Regards,',
    'Team VapePass',
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapEmailLayout({
    title: 'Confirm Password Change',
    preheader: 'Confirm your VapePass password change.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Confirm your password change</h1>
      <p style="margin:0 0 4px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        We received a request to change the password on your VapePass account. Enter the code below to confirm it.
      </p>
      ${buildOtpBlockHtml(otp)}
      <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
        This code expires in ${expiresInMinutes} minutes and can only be used once.
        If you did not request this change, do not share this code${
          links.supportEmail
            ? ` and <a href="mailto:${links.supportEmail}" style="color:${BRAND.purple};text-decoration:none;">contact support</a>`
            : ' and contact support'
        } immediately.
      </p>
    `,
  });

  return { subject, text, html };
}

/**
 * Confirmation that the account password was changed.
 */
export function buildPasswordChangedEmail({ ownerName, changedAt }) {
  const links = getSupportLinks();
  const when = formatDateTime(changedAt || new Date());
  const subject = 'Your VapePass password was changed';
  const text = [
    `Hello ${ownerName || 'there'},`,
    '',
    `Your VapePass account password was changed on ${when}.`,
    '',
    'If this was you, no further action is needed.',
    `If you did not make this change, reset your password immediately: ${links.supportUrl}`,
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Password Changed',
    preheader: 'Your VapePass password was changed.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Password changed</h1>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Your VapePass account password was changed on <strong style="color:${BRAND.ink};">${escapeHtml(when)}</strong>.
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px;line-height:1.6;">
        If this was you, no further action is needed. If you did not make this change, reset your password
        immediately and <a href="${links.supportUrl}" style="color:${BRAND.purple};text-decoration:none;">contact support</a>.
      </p>
    `,
  });

  return { subject, text, html };
}

export function buildRenewalReminderEmail({
  storeName,
  renewalDate,
  amount,
  currency = 'USD',
}) {
  const renewal = formatDate(renewalDate);
  const price = formatMoney(amount, currency);
  const subject = 'Your VapePass Subscription Will Renew Soon';
  const text = [
    `Hi${storeName ? ` ${storeName}` : ''},`,
    '',
    'This is a friendly reminder that your VapePass subscription will renew soon.',
    '',
    `Renewal date: ${renewal}`,
    `Amount: ${price}`,
    '',
    'Please ensure your payment method is up to date to avoid any interruption to your chatbot service.',
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Renewal Reminder',
    preheader: `Your subscription renews on ${renewal}.`,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Your subscription will renew soon</h1>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        This is a billing reminder for <strong style="color:${BRAND.ink};">${storeName || 'your store'}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;">
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};">Renewal date<br/><strong style="color:${BRAND.ink};">${renewal}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Amount<br/><strong style="color:${BRAND.ink};">${price}</strong></td></tr>
      </table>
      <p style="margin:20px 0 0;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        No action is required if your payment method is current. We will charge your card automatically on the renewal date.
      </p>
    `,
  });

  return { subject, text, html };
}

export function buildPaymentFailedEmail({ storeName, retryAttempted = true }) {
  const subject = "We couldn't process your payment";
  const text = [
    `Hi${storeName ? ` ${storeName}` : ''},`,
    '',
    "We couldn't process your payment for your VapePass subscription.",
    retryAttempted
      ? "We'll automatically retry shortly."
      : 'Please update your payment method to restore service.',
    '',
    'Please update your payment method if required.',
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Payment Failed',
    preheader: "We couldn't process your VapePass payment.",
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">We couldn't process your payment</h1>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        We were unable to process the latest payment for <strong style="color:${BRAND.ink};">${storeName || 'your store'}</strong>.
      </p>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        ${retryAttempted ? "We'll automatically retry shortly." : 'Automatic retries have been exhausted.'}
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Please update your payment method if required to keep your dashboard and chatbot active.
      </p>
    `,
  });

  return { subject, text, html };
}

export function buildSubscriptionPausedEmail({ storeName }) {
  const subject = 'Your VapePass subscription is paused';
  const text = [
    `Hi${storeName ? ` ${storeName}` : ''},`,
    '',
    'Your VapePass subscription has been paused after repeated payment failures.',
    'Your dashboard is locked and the chatbot has been disabled until billing is updated.',
    '',
    'Regards,',
    'Team VapePass',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Subscription Paused',
    preheader: 'Your VapePass subscription is paused.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Subscription Paused</h1>
      <p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Your subscription for <strong style="color:${BRAND.ink};">${storeName || 'your store'}</strong> is paused after repeated payment failures.
        The dashboard is locked and the chatbot embedding script will not load until you update billing.
      </p>
    `,
  });

  return { subject, text, html };
}

/**
 * Customer confirmation after Free Setup Assistance request.
 */
export function buildSetupRequestCustomerEmail({
  customerName,
  storeName,
  websiteUrl,
}) {
  const safeName = escapeHtml(customerName || 'there');
  const safeStore = escapeHtml(storeName || 'Your store');
  const safeWebsite = escapeHtml(websiteUrl || '—');
  const subject = 'Request Received – VapePass Free Setup Assistance';

  const text = [
    `Hello ${customerName || 'there'},`,
    '',
    'Thank you for requesting our Free Setup Assistance.',
    '',
    'We have successfully received your request.',
    '',
    'Our support team will contact you during business hours to help install the VapePass AI Assistant on your website.',
    '',
    'If required, we can schedule a live support session to complete the installation together.',
    '',
    `Store: ${storeName || 'Your store'}`,
    `Website: ${websiteUrl || '—'}`,
    '',
    'Thank you for choosing VapePass.',
    '',
    'Best Regards,',
    'The VapePass Team',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Free Setup Assistance',
    preheader: 'We received your VapePass free setup request.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Request received</h1>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Hello ${safeName},
      </p>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Thank you for requesting our Free Setup Assistance. We have successfully received your request.
      </p>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Our support team will contact you during business hours to help install the VapePass AI Assistant on your website.
      </p>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        If required, we can schedule a live support session to complete the installation together.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;">
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};">Store<br/><strong style="color:${BRAND.ink};">${safeStore}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Website<br/><strong style="color:${BRAND.ink};word-break:break-all;">${safeWebsite}</strong></td></tr>
      </table>
      <p style="margin:20px 0 0;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Thank you for choosing VapePass.
      </p>
    `,
  });

  return { subject, text, html };
}

/** Where a support submission originated in the product */
export const SUPPORT_SOURCES = {
  REQUEST_ASSISTANCE: 'request_assistance',
  NEED_HELP: 'need_help',
};

function describeSupportSource(source) {
  if (source === SUPPORT_SOURCES.NEED_HELP) {
    return {
      subject: 'Need Help Submission',
      heading: 'Need Help Submission',
      feature: 'Need Help',
      intro:
        'This request was submitted from the <strong>Need Help</strong> feature. Details below:',
      introText: 'This request was submitted from the Need Help feature.',
    };
  }

  return {
    subject: 'Request Assistance Submission',
    heading: 'Request Assistance Submission',
    feature: 'Request Assistance',
    intro:
      'This request was submitted from the <strong>Request Assistance</strong> feature. Details below:',
    introText: 'This request was submitted from the Request Assistance feature.',
  };
}

/**
 * Admin notification for a Request Assistance / Need Help submission.
 */
export function buildSetupRequestAdminEmail({
  customerName,
  storeName,
  email,
  phone,
  websiteUrl,
  message,
  submittedAt,
  source = SUPPORT_SOURCES.REQUEST_ASSISTANCE,
}) {
  const submitted = formatDateTime(submittedAt || new Date());
  const descriptor = describeSupportSource(source);

  const text = [
    descriptor.heading,
    '',
    descriptor.introText,
    '',
    `Owner Name: ${customerName || '—'}`,
    `Store Name: ${storeName || '—'}`,
    `Email: ${email || '—'}`,
    `Phone Number: ${phone || '—'}`,
    `Store URL: ${websiteUrl || '—'}`,
    `Submitted Message: ${message || '—'}`,
    `Timestamp: ${submitted}`,
    `Submitted From: ${descriptor.feature}`,
    '',
    'Please follow up during business hours.',
  ].join('\n');

  const html = wrapEmailLayout({
    title: descriptor.heading,
    preheader: `${customerName || 'A retailer'} submitted the ${descriptor.feature} form.`,
    internal: true,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">${descriptor.heading}</h1>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        ${descriptor.intro}
      </p>
      ${buildDetailTableHtml([
        { label: 'Owner Name', value: customerName },
        { label: 'Store Name', value: storeName },
        { label: 'Email', value: email },
        { label: 'Phone Number', value: phone },
        { label: 'Store URL', value: websiteUrl, wrap: true },
        { label: 'Submitted Message', value: message, preserveLines: true },
        { label: 'Timestamp', value: submitted },
        { label: 'Submitted From', value: descriptor.feature },
      ])}
    `,
  });

  return { subject: descriptor.subject, text, html };
}

/**
 * Customer confirmation after pricing Contact Us submission.
 */
export function buildContactLeadCustomerEmail({
  ownerName,
  storeName,
  startDate,
}) {
  const safeName = escapeHtml(ownerName || 'there');
  const safeStore = escapeHtml(storeName || 'Your store');
  const startLabel = startDate ? formatDate(startDate) : 'Not specified';
  const subject = 'We received your VapePass inquiry';

  const text = [
    `Hello ${ownerName || 'there'},`,
    '',
    'Thank you for contacting VapePass.',
    '',
    'We received your inquiry and our team will reach out shortly to help get your store set up.',
    '',
    `Store: ${storeName || 'Your store'}`,
    `Preferred start: ${startLabel}`,
    '',
    'Thank you for choosing VapePass.',
    '',
    'Best Regards,',
    'The VapePass Team',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'Contact inquiry received',
    preheader: 'We received your VapePass contact request.',
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">Thanks for reaching out</h1>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Hello ${safeName},
      </p>
      <p style="margin:0 0 16px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Thank you for contacting VapePass. We received your inquiry and our team will reach out shortly.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;">
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};">Store<br/><strong style="color:${BRAND.ink};">${safeStore}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Preferred start<br/><strong style="color:${BRAND.ink};">${escapeHtml(startLabel)}</strong></td></tr>
      </table>
      <p style="margin:20px 0 0;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Thank you for choosing VapePass.
      </p>
    `,
  });

  return { subject, text, html };
}

/**
 * Admin notification for a new pricing Contact Us lead.
 */
export function buildContactLeadAdminEmail({
  ownerName,
  storeName,
  email,
  phone,
  startDate,
  message,
  submittedAt,
}) {
  const submitted = formatDateTime(submittedAt || new Date());
  const startLabel = startDate ? formatDate(startDate) : 'Not specified';
  const safe = {
    ownerName: escapeHtml(ownerName || '—'),
    storeName: escapeHtml(storeName || '—'),
    email: escapeHtml(email || '—'),
    phone: escapeHtml(phone || '—'),
    startDate: escapeHtml(startLabel),
    message: escapeHtml(message || '—'),
    submitted: escapeHtml(submitted),
  };

  const subject = 'New VapePass Contact Inquiry';
  const text = [
    'New VapePass Contact Inquiry',
    '',
    `Owner Name: ${ownerName || '—'}`,
    `Store Name: ${storeName || '—'}`,
    `Email: ${email || '—'}`,
    `Phone Number: ${phone || '—'}`,
    `Preferred start: ${startLabel}`,
    `Message: ${message || '—'}`,
    `Submission Date & Time: ${submitted}`,
    '',
    'Please follow up during business hours.',
  ].join('\n');

  const html = wrapEmailLayout({
    title: 'New Contact Inquiry',
    preheader: `${ownerName || 'A prospect'} submitted the pricing contact form.`,
    internal: true,
    bodyHtml: `
      <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};">New Contact Inquiry</h1>
      <p style="margin:0 0 20px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
        Someone submitted the pricing Contact Us form. Details below:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;">
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};">Owner Name<br/><strong style="color:${BRAND.ink};">${safe.ownerName}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Store Name<br/><strong style="color:${BRAND.ink};">${safe.storeName}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Email<br/><strong style="color:${BRAND.ink};">${safe.email}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Phone Number<br/><strong style="color:${BRAND.ink};">${safe.phone}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Preferred start<br/><strong style="color:${BRAND.ink};">${safe.startDate}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Message<br/><strong style="color:${BRAND.ink};white-space:pre-wrap;">${safe.message}</strong></td></tr>
        <tr><td style="padding:14px 18px;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">Submission Date &amp; Time<br/><strong style="color:${BRAND.ink};">${safe.submitted}</strong></td></tr>
      </table>
    `,
  });

  return { subject, text, html };
}
