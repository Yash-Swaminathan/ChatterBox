const logger = require('../utils/logger');

const NTFY_BASE_URL = 'https://ntfy.sh';
const RESEND_API_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 8000;
const PREVIEW_LENGTH = 200;

/**
 * Escape text for safe inclusion in HTML email bodies
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTTP headers must be ASCII and single-line; user-supplied text is neither
 * @param {string} value
 * @returns {string}
 */
function toHeaderValue(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 120);
}

function preview(text) {
  const value = String(text ?? '');
  return value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}...` : value;
}

/**
 * @returns {string} Public URL of the web app, without a trailing slash
 */
function getAppUrl() {
  return (process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(
    /\/+$/,
    ''
  );
}

/**
 * Send a push notification to the owner's phone through ntfy.sh.
 * No-op when NTFY_TOPIC is not set. Never throws.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.body
 * @param {string} [options.clickUrl] - Opened when the notification is tapped
 * @param {string} [options.priority] - ntfy priority (default, high, ...)
 * @returns {Promise<boolean>} True if sent
 */
async function sendPush({ title, body, clickUrl, priority = 'default' }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    logger.debug('Push skipped: NTFY_TOPIC is not set');
    return false;
  }

  try {
    const headers = {
      Title: toHeaderValue(title),
      Priority: priority,
      Tags: 'speech_balloon',
    };
    if (clickUrl) {
      headers.Click = clickUrl;
    }

    const response = await fetch(`${NTFY_BASE_URL}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers,
      body: preview(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error('Push notification failed', { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.error('Push notification failed', { error: error.message });
    return false;
  }
}

/**
 * Send an email through Resend.
 * No-op when RESEND_API_KEY or EMAIL_FROM is not set. Never throws.
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html - Must already be escaped
 * @param {string} options.text - Plain-text alternative
 * @returns {Promise<boolean>} True if sent
 */
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from || !to) {
    logger.debug('Email skipped: RESEND_API_KEY, EMAIL_FROM or recipient is missing');
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error('Email failed', { status: response.status, subject });
      return false;
    }
    return true;
  } catch (error) {
    logger.error('Email failed', { error: error.message, subject });
    return false;
  }
}

function layout(bodyHtml) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">${bodyHtml}</div>`;
}

function button(url, label) {
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;text-decoration:none;border-radius:3px">${escapeHtml(label)}</a></p>`;
}

/**
 * Tell the owner that a visitor sent a message (push + email)
 * @param {Object} options
 * @param {string} options.senderName
 * @param {string} options.content - Message text
 */
async function notifyOwnerOfMessage({ senderName, content }) {
  const url = `${getAppUrl()}/chat`;
  const title = `New message from ${senderName}`;

  await Promise.all([
    sendPush({ title, body: content, clickUrl: url, priority: 'high' }),
    sendEmail({
      to: process.env.OWNER_EMAIL,
      subject: `ChatterBox: ${title}`,
      text: `${senderName} wrote:\n\n${preview(content)}\n\nReply: ${url}`,
      html: layout(
        `<p><strong>${escapeHtml(senderName)}</strong> sent you a message:</p>` +
          `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #000;background:#f5f5f5">${escapeHtml(preview(content))}</blockquote>` +
          button(url, 'Reply')
      ),
    }),
  ]);
}

/**
 * Remind the owner about a visitor who is still waiting for a reply (push + email)
 * @param {Object} options
 * @param {string} options.senderName
 * @param {number} options.minutesWaiting
 */
async function notifyOwnerReminder({ senderName, minutesWaiting }) {
  const url = `${getAppUrl()}/chat`;
  const text = `You haven't replied to ${senderName} yet - they messaged ${minutesWaiting} min ago`;

  await Promise.all([
    sendPush({ title: 'Reply reminder', body: text, clickUrl: url }),
    sendEmail({
      to: process.env.OWNER_EMAIL,
      subject: `ChatterBox: ${senderName} is waiting for a reply`,
      text: `${text}\n\nReply: ${url}`,
      html: layout(`<p>${escapeHtml(text)}</p>` + button(url, 'Reply')),
    }),
  ]);
}

/**
 * Email a visitor that the owner replied while they were away
 * @param {Object} options
 * @param {string} options.to - Visitor's email address
 * @param {string} options.ownerName
 * @param {string} options.content - Message text
 * @param {string} options.unsubscribeUrl
 * @returns {Promise<boolean>} True if sent
 */
async function notifyVisitorOfReply({ to, ownerName, content, unsubscribeUrl }) {
  const url = `${getAppUrl()}/chat`;

  return sendEmail({
    to,
    subject: `${ownerName} replied to you on ChatterBox`,
    text:
      `${ownerName} replied:\n\n${preview(content)}\n\nContinue the conversation: ${url}\n\n` +
      `Stop these emails: ${unsubscribeUrl}`,
    html: layout(
      `<p><strong>${escapeHtml(ownerName)}</strong> replied to you:</p>` +
        `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #000;background:#f5f5f5">${escapeHtml(preview(content))}</blockquote>` +
        button(url, 'Continue the conversation') +
        '<p style="font-size:12px;color:#666">You are receiving this because you have a ChatterBox account. ' +
        `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#666">Stop these emails</a>.</p>`
    ),
  });
}

/**
 * Email a password reset link
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.resetUrl
 * @param {number} options.expiresInMinutes
 * @returns {Promise<boolean>} True if sent
 */
async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }) {
  return sendEmail({
    to,
    subject: 'Reset your ChatterBox password',
    text:
      `Use this link to choose a new password. It works once and expires in ${expiresInMinutes} minutes.\n\n` +
      `${resetUrl}\n\nIf you did not ask for this, you can ignore this email.`,
    html: layout(
      `<p>Use the button below to choose a new password. The link works once and expires in ${expiresInMinutes} minutes.</p>` +
        button(resetUrl, 'Reset password') +
        '<p style="font-size:12px;color:#666">If you did not ask for this, you can ignore this email.</p>'
    ),
  });
}

module.exports = {
  escapeHtml,
  getAppUrl,
  sendPush,
  sendEmail,
  notifyOwnerOfMessage,
  notifyOwnerReminder,
  notifyVisitorOfReply,
  sendPasswordResetEmail,
};
