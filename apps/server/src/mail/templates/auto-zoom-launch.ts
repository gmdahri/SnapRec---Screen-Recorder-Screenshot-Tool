/**
 * Product announcement: SnapRec Auto-Zoom Feature
 */

export const SNAPREC_CHROME_STORE_URL =
    'https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg';

export type AutoZoomLaunchOptions = {
    extensionUrl?: string;
};

export function getAutoZoomLaunchEmailHtml(
    name: string | undefined,
    opts: AutoZoomLaunchOptions,
): string {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    const extensionUrl = opts.extensionUrl ?? SNAPREC_CHROME_STORE_URL;

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
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;color:#8b5cf6;text-transform:uppercase;">New Feature Alert</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">Cinematic Auto-Zoom is Live 🎬</h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${greeting}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">
                Tired of spending hours editing your screen recordings to make them look professional? Today, we are thrilled to introduce <strong>Auto-Zoom</strong> natively inside SnapRec.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">
                Here is how it works: just record your screen as normal. Whenever you click your mouse, our intelligent algorithm automatically scales the camera into the action and seamlessly pans the viewport to follow your cursor. Zero editing skills required!
              </p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0f172a;">How to access it</p>
              <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.6;color:#475569;">
                <li style="margin-bottom:8px;"><strong>Update your extension</strong> — Ensure you are on version 1.2.7 or higher.</li>
                <li style="margin-bottom:8px;"><strong>Record a video</strong> — Just capture a quick screen recording and click around.</li>
                <li style="margin-bottom:0;"><strong>No toggling necessary</strong> — Auto-Zoom is enabled by default in the Video Editor to instantly generate cinematic transitions!</li>
              </ul>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-radius:12px;background:#8b5cf6;">
                    <a href="${extensionUrl}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Try Auto-Zoom Now</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#94a3b8;">
                <a href="${extensionUrl}" style="color:#8b5cf6;text-decoration:underline;">${extensionUrl}</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#64748b;">Thanks for sticking with SnapRec. We can't wait to see what you create!</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#64748b;">Questions or feedback? Just reply to this email.</p>
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
