/**
 * Product announcement: SnapRec Video Editor launch (no product link until deployed).
 */

/** SnapRec on Chrome Web Store (same as founder welcome). */
export const SNAPREC_CHROME_STORE_URL =
    'https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg';

export type VideoEditorLaunchOptions = {
    /** e.g. "Tuesday, March 18" */
    launchDateText: string;
    /** Override CWS URL if listing changes */
    extensionUrl?: string;
};

export function getVideoEditorLaunchEmailHtml(
    name: string | undefined,
    opts: VideoEditorLaunchOptions,
): string {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    const { launchDateText } = opts;
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
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;color:#8b5cf6;text-transform:uppercase;">Coming to SnapRec</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">Video Editor drops ${launchDateText}</h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${greeting}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">
                We’re launching a full <strong>in-browser video editor</strong> so you can trim, arrange, and export screen recordings without leaving SnapRec. Until then—<strong>keep recording</strong>. Every clip you capture now is one you’ll be able to polish the moment the editor is live.
              </p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0f172a;">What’s coming</p>
              <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.6;color:#475569;">
                <li style="margin-bottom:8px;"><strong>Projects</strong> — Create and reopen projects; keep edits organized.</li>
                <li style="margin-bottom:8px;"><strong>Media library</strong> — Import clips, duration &amp; resolution, quick search.</li>
                <li style="margin-bottom:8px;"><strong>Multi-track timeline</strong> — Video plus mic/system audio.</li>
                <li style="margin-bottom:8px;"><strong>Trim</strong> — Cut in and out; dedicated trim flow.</li>
                <li style="margin-bottom:8px;"><strong>Effects</strong> — Effects workspace built in.</li>
                <li style="margin-bottom:8px;"><strong>Export</strong> — Format, resolution, quality, with progress.</li>
                <li style="margin-bottom:0;"><strong>Share</strong> — Same share flow you already use after recording.</li>
              </ul>
              <p style="margin:0 0 16px;padding:16px 18px;background:#f1f5f9;border-radius:12px;font-size:15px;line-height:1.65;color:#475569;">
                <strong style="color:#0f172a;">Right now:</strong> Record as usual—preview, copy link, and download still work like always. The new video editor isn’t live yet; we’ll let you know when you can open it from SnapRec.
              </p>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#475569;">
                Don’t have the extension installed (or need it on another profile)? Grab it from the Chrome Web Store—then <strong>keep recording</strong> so you’re ready when the editor ships.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-radius:12px;background:#8b5cf6;">
                    <a href="${extensionUrl}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Install SnapRec — Chrome Web Store</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#94a3b8;">
                <a href="${extensionUrl}" style="color:#8b5cf6;text-decoration:underline;">${extensionUrl}</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#64748b;">Thanks for sticking with SnapRec. Keep the recordings coming—we’re building this for how you already work.</p>
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
