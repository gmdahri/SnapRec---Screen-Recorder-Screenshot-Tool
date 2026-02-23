/**
 * Personal founder welcome email template — inspired by Zeno Rocha's (Resend CEO) style.
 * Simple, text-based, personal feel. No heavy branding — just a human message.
 */
export function getFounderWelcomeEmailHtml(name?: string): string {
    const greeting = name ? `Hey ${name},` : 'Hey,';

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
                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    ${greeting}
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    My name is Ghulam Muhammad — I'm the founder of SnapRec.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    We built SnapRec because we wanted a simpler, faster way to capture and share your screen.
                    No complicated tools, no bloated apps — just click, capture, and share.
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    Here are 3 things to try:
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">
                    <tr>
                        <td style="padding: 6px 0;">
                            <a href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg" style="font-size: 15px; color: #6366f1; text-decoration: underline;">Install the Chrome Extension</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0;">
                            <a href="https://www.snaprecorder.org" style="font-size: 15px; color: #6366f1; text-decoration: underline;">Take your first screenshot or recording</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0;">
                            <a href="https://www.snaprecorder.org/how-it-works" style="font-size: 15px; color: #6366f1; text-decoration: underline;">See how it works</a>
                        </td>
                    </tr>
                </table>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    <strong>P.S.:</strong> What are you planning to use SnapRec for? Bug reports, tutorials, team communication?
                </p>

                <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    Hit "Reply" and let me know. I read and reply to every email.
                </p>

                <p style="margin: 0 0 4px; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    Cheers,
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
                    <strong>Ghulam Muhammad</strong><br>
                    <span style="color: #6b7280; font-size: 13px;">Founder, SnapRec</span>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();
}
