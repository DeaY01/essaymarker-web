import 'server-only';

import { randomUUID } from 'node:crypto';
import type { User } from '@supabase/supabase-js';

import { escapeHtml, sendBrevoEmail } from '@/lib/brevo';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const SUBJECT = 'Welcome to EssayMarker — How to get started for WAEC & NECO';

function getFirstName(user: User): string {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName !== 'string') return 'Student';

  return fullName.trim().split(/\s+/u)[0] || 'Student';
}

function getDashboardUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://essay.olearn.com.ng';
  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('URL must use HTTP or HTTPS.');
    }
    return new URL('/', url).toString();
  } catch (error) {
    console.error('Welcome email not sent: NEXT_PUBLIC_SITE_URL is invalid.', error);
    return null;
  }
}

function createWelcomeEmail(firstName: string, dashboardUrl: string) {
  const escapedName = escapeHtml(firstName);
  const escapedDashboardUrl = escapeHtml(dashboardUrl);
  const text = `Hi ${firstName},

Your email is confirmed—welcome to EssayMarker! You're now set up to practice WAEC and NECO English essays the way you actually write them in the exam: on paper.

How to Use EssayMarker
1. Write by hand: Draft your essay or letter on paper (aiming for 400–450 words for full exam practice).
2. Snap a clear photo: Take a well-lit, steady photo of each page so your handwriting is easy to read. (If a photo is too blurry, we'll ask you to resnap instead of unfairly docking marks.)
3. Upload & get feedback: Submit your pages to get a score out of 50 using the WAEC/NECO COEM rubric (Content, Organisation, Expression, Mechanical Accuracy), plus detailed spelling, punctuation, and improvement notes.

What You Can Explore Inside
- Handwritten Essay Grading & COEM Breakdown: See how your draft scores across all four marking areas and spot spelling and punctuation slips to fix before exam day.
- Past Questions Viewer: Browse available WAEC and NECO past questions right inside the app without clunky downloads.
- Video Lessons & Daily Words: Strengthen weak topics with tutor video lessons and build exam vocabulary with daily words (meaning, usage, synonyms, and antonyms).
- Units & Top-Ups: Top up marking units via Paystack whenever you're ready to grade essays and unlock lessons (and if a school or tutorial center shared a partner code with you, make sure it's applied when topping up).

Note: EssayMarker is a practice and learning tool to help you prepare—it does not represent an official WAEC or NECO examination score.

Ready to start? Head to your dashboard.

Wishing you steady progress in your preparation,
The EssayMarker Team`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f4f6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
    <table role="presentation" style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr>
        <td style="background:#1E3A8A;padding:24px 32px;border-bottom:5px solid #F59E0B">
          <div style="font-size:24px;font-weight:700;color:#ffffff">Essay<span style="color:#F59E0B">Marker</span></div>
          <div style="margin-top:4px;color:#dbeafe;font-size:14px">WAEC &amp; NECO English essay practice</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px">
          <p style="margin:0 0 16px">Hi ${escapedName},</p>
          <p style="margin:0 0 24px">Your email is confirmed—welcome to EssayMarker! You're now set up to practice WAEC and NECO English essays the way you actually write them in the exam: on paper.</p>
          <h2 style="margin:0 0 12px;color:#1E3A8A;font-size:20px">How to Use EssayMarker</h2>
          <ol style="margin:0 0 24px;padding-left:22px">
            <li style="margin-bottom:8px"><strong>Write by hand:</strong> Draft your essay or letter on paper (aiming for 400–450 words for full exam practice).</li>
            <li style="margin-bottom:8px"><strong>Snap a clear photo:</strong> Take a well-lit, steady photo of each page so your handwriting is easy to read. (If a photo is too blurry, we'll ask you to resnap instead of unfairly docking marks.)</li>
            <li><strong>Upload &amp; get feedback:</strong> Submit your pages to get a score out of 50 using the WAEC/NECO COEM rubric (Content, Organisation, Expression, Mechanical Accuracy), plus detailed spelling, punctuation, and improvement notes.</li>
          </ol>
          <h2 style="margin:0 0 12px;color:#1E3A8A;font-size:20px">What You Can Explore Inside</h2>
          <ul style="margin:0 0 24px;padding-left:22px">
            <li style="margin-bottom:8px"><strong>Handwritten Essay Grading &amp; COEM Breakdown:</strong> See how your draft scores across all four marking areas and spot spelling and punctuation slips to fix before exam day.</li>
            <li style="margin-bottom:8px"><strong>Past Questions Viewer:</strong> Browse available WAEC and NECO past questions right inside the app without clunky downloads.</li>
            <li style="margin-bottom:8px"><strong>Video Lessons &amp; Daily Words:</strong> Strengthen weak topics with tutor video lessons and build exam vocabulary with daily words (meaning, usage, synonyms, and antonyms).</li>
            <li><strong>Units &amp; Top-Ups:</strong> Top up marking units via Paystack whenever you're ready to grade essays and unlock lessons (and if a school or tutorial center shared a partner code with you, make sure it's applied when topping up).</li>
          </ul>
          <p style="margin:0 0 24px;padding:14px 16px;border-left:4px solid #D97706;background:#fffbeb;font-size:14px"><strong>Note:</strong> EssayMarker is a practice and learning tool to help you prepare—it does not represent an official WAEC or NECO examination score.</p>
          <p style="margin:0 0 20px">Ready to start? <a href="${escapedDashboardUrl}" style="color:#1D4ED8;font-weight:700">Head to your dashboard.</a></p>
          <p style="margin:0">Wishing you steady progress in your preparation,<br><strong style="color:#1E3A8A">The EssayMarker Team</strong></p>
        </td>
      </tr>
      <tr><td style="height:6px;background:#D97706"></td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

/**
 * Sends only for confirmed accounts. The database claim serializes concurrent
 * sign-ins; unsuccessful sends release it so a later sign-in can retry.
 */
export async function sendWelcomeEmailIfConfirmed(user: User): Promise<void> {
  if (!user.email) {
    console.warn('Welcome email skipped: confirmed user has no email address.');
    return;
  }
  if (!user.email_confirmed_at) {
    console.info('Welcome email skipped: user email is not confirmed.');
    return;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error('Welcome email not sent: SUPABASE_SECRET_KEY is not set.');
    return;
  }

  const dashboardUrl = getDashboardUrl();
  if (!dashboardUrl) return;

  const email = createWelcomeEmail(getFirstName(user), dashboardUrl);
  const claimToken = randomUUID();
  const { data: claimed, error: claimError } = await admin.rpc('claim_welcome_email', {
    p_user_id: user.id,
    p_claim_token: claimToken,
  });
  if (claimError) {
    console.error('Could not claim welcome email:', claimError.message);
    return;
  }
  if (!claimed) {
    console.info('Welcome email skipped: it was already sent, another attempt is active, or no profile is eligible.');
    return;
  }

  const sent = await sendBrevoEmail({
    to: user.email,
    subject: SUBJECT,
    ...email,
  });

  const { data: completed, error: completionError } = await admin.rpc('finish_welcome_email', {
    p_user_id: user.id,
    p_claim_token: claimToken,
    p_sent: sent,
  });
  if (completionError) {
    console.error('Could not finish welcome email attempt:', completionError.message);
  } else if (!completed) {
    console.error('Could not finish welcome email attempt: claim no longer belongs to this request.');
  } else if (sent) {
    console.info('Welcome email sent successfully.');
  } else {
    console.warn('Welcome email was not sent; the claim was released so a later sign-in can retry.');
  }
}
