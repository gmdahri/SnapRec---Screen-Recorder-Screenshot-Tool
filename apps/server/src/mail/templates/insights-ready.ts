/**
 * Email sent when AI transcript + summary finish processing for a recording.
 */
export function getInsightsReadyEmailHtml(params: {
    name?: string;
    recordingTitle: string;
    shareUrl: string;
    tldr: string;
    topActionItems: string[];
}): string {
    const greeting = params.name ? `Hi ${params.name}` : 'Hi there';
    const actionItemsHtml = params.topActionItems.length
        ? `
            <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #ffffff;">Top action items</h3>
            <ul style="margin: 0 0 24px; padding-left: 20px; color: #c4c4d0; font-size: 14px; line-height: 1.7;">
                ${params.topActionItems.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
            </ul>`
        : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your SnapRec summary is ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f13;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">🎬 SnapRec</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1a1a24; border-radius: 16px; padding: 40px 36px; border: 1px solid rgba(255,255,255,0.06);">
                            <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #ffffff;">Your AI summary is ready</h2>
                            <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #a1a1b5;">
                                ${greeting}, we just finished transcribing and summarizing <strong style="color:#fff;">${escapeHtml(params.recordingTitle)}</strong>.
                            </p>

                            <div style="background:#121219;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin:0 0 24px;">
                                <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#8b5cf6;letter-spacing:0.4px;text-transform:uppercase;">TL;DR</h3>
                                <p style="margin:0;font-size:15px;line-height:1.6;color:#e6e6f0;">${escapeHtml(params.tldr)}</p>
                            </div>

                            ${actionItemsHtml}

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding-top: 8px;">
                                        <a href="${params.shareUrl}" target="_blank"
                                            style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px;">
                                            View full transcript & summary →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 32px 20px 0;">
                            <p style="margin: 0; font-size: 13px; color: #64648a; line-height: 1.5;">
                                You're receiving this because AI insights are enabled on your SnapRec Pro account.
                            </p>
                            <p style="margin: 8px 0 0; font-size: 12px; color: #4a4a6a;">
                                © ${new Date().getFullYear()} SnapRec. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
