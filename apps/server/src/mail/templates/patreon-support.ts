/**
 * Support appeal: help keep SnapRec free by backing us on Patreon.
 */

export const SNAPREC_PATREON_URL = 'https://www.patreon.com/cw/SnapRec';

export type PatreonSupportOptions = {
    patreonUrl?: string;
};

/**
 * Plain founder-style variant, matching founder-welcome.ts.
 *
 * Gmail sorted the rich version below into the Promotions tab; a message with no card
 * chrome, no CTA button and one inline link reads as personal mail instead of a campaign,
 * which is what a donation ask needs to be seen at all.
 */
export function getPatreonSupportPlainHtml(
    name: string | undefined,
    opts: PatreonSupportOptions = {},
): string {
    const greeting = name ? `Hey ${name},` : 'Hey,';
    const patreonUrl = opts.patreonUrl ?? SNAPREC_PATREON_URL;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding: 40px 24px; max-width: 560px;">
                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">${greeting}</p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    Ghulam here, founder of SnapRec. I have an honest ask.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    SnapRec has been free since day one — unlimited recordings, screenshots,
                    the video editor, auto-zoom. I want to keep it that way.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    But storage, bandwidth for every video you share, and servers all cost real
                    money each month, and the bill grows as more people record. I've been paying
                    it out of pocket.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    If SnapRec has saved you time, you can help cover it here:<br>
                    <a href="${patreonUrl}" style="font-size: 15px; color: #6366f1; text-decoration: underline;">${patreonUrl}</a>
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    Even a couple of dollars a month makes a real difference at our size, and it's
                    what lets me say no to paywalls and ads.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    And if now isn't the right time, no problem at all — SnapRec stays free for you
                    either way. Sharing it with someone who'd find it useful helps just as much.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7;">
                    Hit "Reply" if you have thoughts. I read every email.
                </p>

                <p style="margin: 0 0 4px; font-size: 15px; line-height: 1.7;">Thanks for using SnapRec,</p>
                <p style="margin: 0; font-size: 15px; line-height: 1.7;">
                    <strong>Ghulam Muhammad</strong><br>
                    <span style="color: #6b7280; font-size: 13px;">Founder, SnapRec</span>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();
}

export function getPatreonSupportEmailHtml(
    name: string | undefined,
    opts: PatreonSupportOptions = {},
): string {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    const patreonUrl = opts.patreonUrl ?? SNAPREC_PATREON_URL;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;color:#8b5cf6;text-transform:uppercase;">A small ask</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">Help us keep SnapRec free ❤️</h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${greeting}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">
                SnapRec has always been free — unlimited recordings, screenshots, the video editor, auto-zoom, all of it. We'd like to keep it that way.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">
                But keeping it running isn't free for us. Storage, bandwidth for every video you share, and servers all cost real money every month, and that bill grows as more people record. Right now we're covering it out of pocket.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">
                If SnapRec has saved you time, you can help us cover those costs by supporting us on Patreon. Even a couple of dollars a month makes a real difference at our size — and it's what lets us say no to paywalls and ads.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-radius:12px;background:#8b5cf6;">
                    <a href="${patreonUrl}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Support SnapRec on Patreon</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#94a3b8;">
                <a href="${patreonUrl}" style="color:#8b5cf6;text-decoration:underline;">${patreonUrl}</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#64748b;">
                And if now isn't the right time — no problem at all. SnapRec stays free for you either way. Sharing it with someone who'd find it useful helps just as much.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#64748b;">Questions or feedback? Just reply to this email — it comes straight to us.</p>
              <p style="margin:12px 0 0;font-size:14px;color:#64748b;">— The SnapRec team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
