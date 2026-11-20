import 'server-only';

// Transactional email through Brevo (https://developers.brevo.com).

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

interface BrevoEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends one email. Returns false (and logs why) instead of throwing, so a
 * missing key or a Brevo outage never breaks the action that triggered it.
 */
export async function sendBrevoEmail(email: BrevoEmail): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail) {
    console.warn('Email not sent: BREVO_API_KEY and BREVO_SENDER_EMAIL must be set.');
    return false;
  }

  try {
    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME?.trim() || 'EssayMarker' },
        to: [{ email: email.to }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`Brevo email failed (${response.status}):`, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Brevo email failed:', error);
    return false;
  }
}

/** Escapes text for use inside HTML email content. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
