/**
 * Brevo (formerly Sendinblue) transactional email client.
 * API docs: https://developers.brevo.com/reference/sendtransacemail
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Send a transactional email via Brevo.
 */
export async function sendEmail({
  to,
  toName,
  subject,
  htmlContent,
  textContent,
}: SendEmailOptions): Promise<{ ok: boolean; status?: number; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[brevo] BREVO_API_KEY not configured, skipping email');
    return { ok: false, error: 'BREVO_API_KEY not configured' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@ciiic.nl';
  const senderName = process.env.BREVO_SENDER_NAME || 'CIIIC Docs';

  const payload = {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: [
      {
        email: to,
        ...(toName ? { name: toName } : {}),
      },
    ],
    subject,
    htmlContent,
    ...(textContent ? { textContent } : {}),
  };

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 10000);

  try {
    const resp = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: text || `HTTP ${resp.status}` };
    }

    return { ok: true, status: resp.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

// Email template styles
const EMAIL_STYLES = {
  body: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;",
  button:
    'display: inline-block; background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px;',
  hr: 'border: none; border-top: 1px solid #eee; margin: 24px 0;',
  muted: 'font-size: 12px; color: #888;',
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail({
  recipientEmail,
  resetUrl,
}: {
  recipientEmail: string;
  resetUrl: string;
  expiresAt?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const subject = 'Reset your password';

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${EMAIL_STYLES.body}">
  <p>Hi there,</p>

  <p>We received a request to reset your password. Click the button below to choose a new password:</p>

  <p style="margin: 24px 0;">
    <a href="${escapeHtml(resetUrl)}" style="${EMAIL_STYLES.button}">
      Reset Password
    </a>
  </p>

  <p>This link will expire in 1 hour.</p>

  <p>If you didn't request this, you can safely ignore this email.</p>

  <hr style="${EMAIL_STYLES.hr}">
  <p style="${EMAIL_STYLES.muted}">
    If you're having trouble clicking the button, copy and paste this URL into your browser:<br>
    <span style="word-break: break-all;">${escapeHtml(resetUrl)}</span>
  </p>
</body>
</html>`;

  const textContent = `Hi there,

We received a request to reset your password.

Reset your password: ${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.`;

  return sendEmail({
    to: recipientEmail,
    subject,
    htmlContent,
    textContent,
  });
}

/**
 * Send a magic link email for passwordless login.
 */
export async function sendMagicLinkEmail({
  recipientEmail,
  magicLinkUrl,
}: {
  recipientEmail: string;
  magicLinkUrl: string;
  expiresAt?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const subject = 'Your sign-in link';

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${EMAIL_STYLES.body}">
  <p>Hi there,</p>

  <p>Click the button below to sign in to your account:</p>

  <p style="margin: 24px 0;">
    <a href="${escapeHtml(magicLinkUrl)}" style="${EMAIL_STYLES.button}">
      Sign In
    </a>
  </p>

  <p>This link will expire in 15 minutes.</p>

  <p>If you didn't request this, you can safely ignore this email.</p>

  <hr style="${EMAIL_STYLES.hr}">
  <p style="${EMAIL_STYLES.muted}">
    If you're having trouble clicking the button, copy and paste this URL into your browser:<br>
    <span style="word-break: break-all;">${escapeHtml(magicLinkUrl)}</span>
  </p>
</body>
</html>`;

  const textContent = `Hi there,

Click the link below to sign in to your account:

${magicLinkUrl}

This link will expire in 15 minutes.

If you didn't request this, you can safely ignore this email.`;

  return sendEmail({
    to: recipientEmail,
    subject,
    htmlContent,
    textContent,
  });
}
