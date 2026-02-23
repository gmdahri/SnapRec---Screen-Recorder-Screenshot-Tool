/**
 * Welcome email HTML template for new SnapRec users.
 */
export function getWelcomeEmailHtml(name?: string): string {
    const greeting = name ? `Hi ${name}` : 'Hi there';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to SnapRec!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f13;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">

                    <!-- Logo -->
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                                🎬 SnapRec
                            </h1>
                        </td>
                    </tr>

                    <!-- Main Card -->
                    <tr>
                        <td style="background-color: #1a1a24; border-radius: 16px; padding: 40px 36px; border: 1px solid rgba(255,255,255,0.06);">

                            <!-- Welcome Heading -->
                            <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #ffffff;">
                                Welcome aboard! 🎉
                            </h2>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #a1a1b5;">
                                ${greeting}, thanks for joining SnapRec — the fastest way to capture, record, and share your screen.
                            </p>

                            <!-- Divider -->
                            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;">

                            <!-- Quick Start Steps -->
                            <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #ffffff;">
                                Get started in 3 steps:
                            </h3>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 12px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width: 36px; vertical-align: top;">
                                                    <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff;">1</span>
                                                </td>
                                                <td style="padding-left: 12px; vertical-align: top;">
                                                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">Install the Chrome Extension</p>
                                                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1b5;">One-click install from the Chrome Web Store.</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width: 36px; vertical-align: top;">
                                                    <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff;">2</span>
                                                </td>
                                                <td style="padding-left: 12px; vertical-align: top;">
                                                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">Capture or Record</p>
                                                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1b5;">Take screenshots, record your screen, or capture a specific tab.</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width: 36px; vertical-align: top;">
                                                    <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff;">3</span>
                                                </td>
                                                <td style="padding-left: 12px; vertical-align: top;">
                                                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">Share Instantly</p>
                                                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1b5;">Get a shareable link in one click — no uploads, no hassle.</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;">

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding-top: 8px;">
                                        <a href="https://www.snaprecorder.org" target="_blank"
                                            style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px;">
                                            Open SnapRec Dashboard →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 32px 20px 0;">
                            <p style="margin: 0; font-size: 13px; color: #64648a; line-height: 1.5;">
                                You're receiving this because you signed up for
                                <a href="https://www.snaprecorder.org" style="color: #8b5cf6; text-decoration: none;">SnapRec</a>.
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
