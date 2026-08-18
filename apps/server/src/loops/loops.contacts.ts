/**
 * Pure mapping rules between SnapRec users and Loops contacts.
 *
 * No I/O lives here so both the Nest service and the backfill script can share
 * one copy of the rules — in particular the opt-out rule, which must never
 * differ between the two paths.
 */

export const LOOPS_SOURCE = 'snaprec-app';
export const DEFAULT_EXCLUDED_DOMAINS = ['codingcops.com'];

/** The subset of the User entity the Loops sync needs. */
export interface LoopsContactSource {
    id: string;
    supabaseId: string | null;
    email: string | null;
    fullName: string | null;
    createdAt: Date;
}

export interface LoopsCreatePayload {
    email: string;
    firstName?: string;
    lastName?: string;
    userId: string;
    source: string;
    signedUpDate: number;
    mailingLists: Record<string, boolean>;
}

/**
 * Deliberately narrower than the create payload: no `subscribed` and no
 * `mailingLists`. Sending `subscribed: true` resubscribes a contact who opted
 * out, and re-asserting `mailingLists` re-adds someone who left the list.
 */
export interface LoopsUpdatePayload {
    email: string;
    firstName?: string;
    lastName?: string;
    userId: string;
}

export function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
    const trimmed = (fullName ?? '').trim();
    if (!trimmed) return {};

    const match = /^(\S+)\s+([\s\S]+)$/.exec(trimmed);
    if (!match) return { firstName: trimmed };

    return { firstName: match[1], lastName: match[2].trim() };
}

export function parseExcludedDomains(raw?: string): string[] {
    const parsed = (raw ?? '')
        .split(',')
        .map(d => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);

    return parsed.length ? parsed : [...DEFAULT_EXCLUDED_DOMAINS];
}

export function isExcludedEmail(email: string, excludedDomains: string[]): boolean {
    const domain = email.split('@').pop()?.toLowerCase() ?? '';
    return excludedDomains.some(d => domain === d || domain.endsWith(`.${d}`));
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function userIdOf(user: LoopsContactSource): string {
    return user.supabaseId ?? user.id;
}

export function buildCreatePayload(
    user: LoopsContactSource,
    mailingListId: string,
): LoopsCreatePayload {
    return {
        email: normalizeEmail(user.email!),
        ...splitName(user.fullName),
        userId: userIdOf(user),
        source: LOOPS_SOURCE,
        signedUpDate: user.createdAt.getTime(),
        mailingLists: { [mailingListId]: true },
    };
}

export function buildUpdatePayload(user: LoopsContactSource): LoopsUpdatePayload {
    return {
        email: normalizeEmail(user.email!),
        ...splitName(user.fullName),
        userId: userIdOf(user),
    };
}

/** Drops users with no email, internal addresses, and duplicate emails. */
export function selectSyncableUsers(
    users: LoopsContactSource[],
    excludedDomains: string[],
): LoopsContactSource[] {
    const seen = new Set<string>();
    const syncable: LoopsContactSource[] = [];

    for (const user of users) {
        if (!user.email) continue;

        const key = normalizeEmail(user.email);
        if (!key) continue;
        if (isExcludedEmail(key, excludedDomains)) continue;
        if (seen.has(key)) continue;

        seen.add(key);
        syncable.push(user);
    }

    return syncable;
}
