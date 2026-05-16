import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { getWelcomeEmailHtml } from './templates/welcome';
import { getFounderWelcomeEmailHtml } from './templates/founder-welcome';
import { getInsightsReadyEmailHtml } from './templates/insights-ready';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resend: Resend;
    private readonly fromEmail: string;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        this.resend = new Resend(apiKey);
        this.fromEmail = this.configService.get<string>(
            'RESEND_FROM_EMAIL',
            'SnapRec <onboarding@resend.dev>',
        );
    }

    /**
     * Send a welcome email to a newly registered user.
     * This should be called in a fire-and-forget manner (no await)
     * so it never blocks user creation.
     */
    async sendWelcomeEmail(to: string, name?: string): Promise<void> {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: 'Welcome to SnapRec! 🎬',
                html: getWelcomeEmailHtml(name),
            });

            if (error) {
                this.logger.error(`Failed to send welcome email to ${to}`, error);
                return;
            }

            this.logger.log(`Welcome email sent to ${to} (id: ${data?.id})`);
        } catch (error) {
            this.logger.error(`Exception sending welcome email to ${to}`, error);
        }
    }

    /**
     * Send the "Your AI summary is ready" email after the pipeline finishes for a
     * Pro user's recording. Fire-and-forget like the welcome email.
     */
    async sendInsightsReady(
        to: string,
        name: string | undefined,
        recordingId: string,
        recordingTitle: string,
        tldr: string,
        topActionItems: string[],
    ): Promise<void> {
        try {
            const webBase =
                this.configService.get<string>('WEB_BASE_URL') || 'https://www.snaprecorder.org';
            const shareUrl = `${webBase}/v/${recordingId}`;
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: `Your recording "${recordingTitle}" is ready — summary inside`,
                html: getInsightsReadyEmailHtml({
                    name,
                    recordingTitle,
                    shareUrl,
                    tldr,
                    topActionItems,
                }),
            });
            if (error) {
                this.logger.error(`Failed to send insights-ready email to ${to}`, error);
                return;
            }
            this.logger.log(`Insights-ready email sent to ${to} (id: ${data?.id})`);
        } catch (error) {
            this.logger.error(`Exception sending insights-ready email to ${to}`, error);
        }
    }

    /**
     * Send a personal founder welcome email (text-based, like Zeno Rocha's style).
     * Used for existing users or as a personal touch.
     */
    async sendFounderWelcomeEmail(to: string, name?: string, replyTo?: string): Promise<void> {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to,
                subject: 'Hey from SnapRec 👋',
                replyTo: replyTo || this.fromEmail,
                html: getFounderWelcomeEmailHtml(name),
            });

            if (error) {
                this.logger.error(`Failed to send founder email to ${to}`, error);
                return;
            }

            this.logger.log(`Founder welcome email sent to ${to} (id: ${data?.id})`);
        } catch (error) {
            this.logger.error(`Exception sending founder email to ${to}`, error);
        }
    }
}
