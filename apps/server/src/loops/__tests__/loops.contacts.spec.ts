import {
    LOOPS_SOURCE,
    LoopsContactSource,
    splitName,
    parseExcludedDomains,
    isExcludedEmail,
    buildCreatePayload,
    buildUpdatePayload,
    selectSyncableUsers,
} from '../loops.contacts';

const LIST_ID = 'list_abc123';

function user(overrides: Partial<LoopsContactSource> = {}): LoopsContactSource {
    return {
        id: 'db-uuid-1',
        supabaseId: 'sb-123',
        email: 'Ada@Example.com',
        fullName: 'Ada Lovelace',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        ...overrides,
    };
}

describe('splitName', () => {
    it('splits a two-part name', () => {
        expect(splitName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    });

    it('treats everything after the first space as the last name', () => {
        expect(splitName('Maria del Carmen Ruiz')).toEqual({
            firstName: 'Maria',
            lastName: 'del Carmen Ruiz',
        });
    });

    it('returns only a first name for a single word', () => {
        expect(splitName('Prince')).toEqual({ firstName: 'Prince' });
    });

    it('collapses surrounding and inner whitespace', () => {
        expect(splitName('  Ada   Lovelace  ')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    });

    it('returns an empty object for missing or blank names', () => {
        expect(splitName(null)).toEqual({});
        expect(splitName(undefined)).toEqual({});
        expect(splitName('   ')).toEqual({});
    });
});

describe('parseExcludedDomains', () => {
    it('parses a comma list, stripping @ and whitespace and lowercasing', () => {
        expect(parseExcludedDomains(' @CodingCops.com , Example.ORG ')).toEqual([
            'codingcops.com',
            'example.org',
        ]);
    });

    it('falls back to the default when unset or blank', () => {
        expect(parseExcludedDomains(undefined)).toEqual(['codingcops.com']);
        expect(parseExcludedDomains('')).toEqual(['codingcops.com']);
        expect(parseExcludedDomains('  ,  ')).toEqual(['codingcops.com']);
    });
});

describe('isExcludedEmail', () => {
    const domains = ['codingcops.com'];

    it('excludes an exact domain match', () => {
        expect(isExcludedEmail('gm@codingcops.com', domains)).toBe(true);
    });

    it('excludes a subdomain', () => {
        expect(isExcludedEmail('gm@mail.codingcops.com', domains)).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isExcludedEmail('GM@CodingCops.COM', domains)).toBe(true);
    });

    it('does not exclude a lookalike domain', () => {
        expect(isExcludedEmail('gm@notcodingcops.com', domains)).toBe(false);
    });

    it('allows unrelated domains', () => {
        expect(isExcludedEmail('someone@gmail.com', domains)).toBe(false);
    });
});

describe('buildCreatePayload', () => {
    it('lowercases and trims the email', () => {
        expect(buildCreatePayload(user({ email: '  Ada@Example.COM ' }), LIST_ID).email).toBe(
            'ada@example.com',
        );
    });

    it('uses supabaseId as userId', () => {
        expect(buildCreatePayload(user(), LIST_ID).userId).toBe('sb-123');
    });

    it('falls back to the database id when supabaseId is null', () => {
        expect(buildCreatePayload(user({ supabaseId: null }), LIST_ID).userId).toBe('db-uuid-1');
    });

    it('sets source and signedUpDate as a millisecond timestamp', () => {
        const payload = buildCreatePayload(user(), LIST_ID);
        expect(payload.source).toBe(LOOPS_SOURCE);
        expect(payload.signedUpDate).toBe(new Date('2026-01-15T10:00:00.000Z').getTime());
    });

    it('adds the contact to the mailing list', () => {
        expect(buildCreatePayload(user(), LIST_ID).mailingLists).toEqual({ [LIST_ID]: true });
    });

    it('omits name fields entirely when fullName is missing', () => {
        const payload = buildCreatePayload(user({ fullName: null }), LIST_ID);
        expect('firstName' in payload).toBe(false);
        expect('lastName' in payload).toBe(false);
    });

    it('NEVER includes subscribed', () => {
        expect('subscribed' in buildCreatePayload(user(), LIST_ID)).toBe(false);
    });
});

describe('buildUpdatePayload', () => {
    it('carries email, name and userId', () => {
        expect(buildUpdatePayload(user())).toEqual({
            email: 'ada@example.com',
            firstName: 'Ada',
            lastName: 'Lovelace',
            userId: 'sb-123',
        });
    });

    it('NEVER includes subscribed — it would resubscribe an opted-out contact', () => {
        expect('subscribed' in buildUpdatePayload(user())).toBe(false);
    });

    it('NEVER includes mailingLists — it would re-add someone who left the list', () => {
        expect('mailingLists' in buildUpdatePayload(user())).toBe(false);
    });
});

describe('selectSyncableUsers', () => {
    const domains = ['codingcops.com'];

    it('drops users without an email', () => {
        const result = selectSyncableUsers([user({ email: null }), user({ email: 'a@gmail.com' })], domains);
        expect(result.map(u => u.email)).toEqual(['a@gmail.com']);
    });

    it('drops excluded internal domains', () => {
        const result = selectSyncableUsers(
            [user({ email: 'gm@codingcops.com' }), user({ email: 'a@gmail.com' })],
            domains,
        );
        expect(result.map(u => u.email)).toEqual(['a@gmail.com']);
    });

    it('dedupes by lowercased email, keeping the first occurrence', () => {
        const result = selectSyncableUsers(
            [
                user({ id: 'first', email: 'Dup@Gmail.com' }),
                user({ id: 'second', email: 'dup@gmail.com' }),
            ],
            domains,
        );
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('first');
    });
});
