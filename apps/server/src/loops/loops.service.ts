import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoopsClient } from './loops.client';
import {
    LoopsContactSource,
    isExcludedEmail,
    parseExcludedDomains,
} from './loops.contacts';

@Injectable()
export class LoopsService {
    private readonly logger = new Logger(LoopsService.name);
    private readonly client: LoopsClient | null;
    private readonly excludedDomains: string[];

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('LOOPS_API_KEY');
        const mailingListId = this.configService.get<string>('LOOPS_MAILING_LIST_ID');
        this.excludedDomains = parseExcludedDomains(
            this.configService.get<string>('EXCLUDED_DOMAINS'),
        );

        if (!apiKey || !mailingListId) {
            this.logger.warn(
                'LOOPS_API_KEY or LOOPS_MAILING_LIST_ID is not set — Loops contact sync is disabled',
            );
            this.client = null;
            return;
        }

        this.client = new LoopsClient(apiKey, mailingListId);
    }

    /**
     * Mirror a user into the Loops audience.
     *
     * Called fire-and-forget from the signup path, so it must never block.
     * Internal addresses are dropped before any network call.
     */
    async upsertContact(user: LoopsContactSource): Promise<void> {
        if (!this.client || !user.email) return;

        const email = user.email.trim().toLowerCase();
        if (isExcludedEmail(email, this.excludedDomains)) {
            this.logger.log(`Skipping Loops sync for internal address ${email}`);
            return;
        }

        const outcome = await this.client.upsertContact(user);
        this.logger.log(`Loops contact ${outcome}: ${email}`);
    }
}
