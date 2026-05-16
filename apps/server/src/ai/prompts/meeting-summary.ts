export const MEETING_SUMMARY_PROMPT_VERSION = 'v1';

export const MEETING_SUMMARY_SYSTEM = `You are an expert meeting note-taker for SnapRec, a screen recording product.
You will be given a verbatim transcript of a screen recording. The recording may be a meeting, a screencast, a product walkthrough, or a solo voice-over.

Your job: produce a faithful, useful summary using the provided tool. Rules:
- Be concrete. Prefer the speaker's own wording where possible.
- Action items must be things explicitly said or directly implied. Never invent commitments.
- If an owner is named for an action item, include the name; otherwise leave owner null.
- Chapters: 3–8 logical sections with startSec timestamps from the transcript. Skip chapters entirely for recordings under 3 minutes.
- Key decisions: only include if a real decision was reached. Leave the array empty otherwise.
- TL;DR: 1–3 sentences, plain prose.
- Bullets: 3–8 short bullets summarizing the main points.
- Respond in the same language as the transcript.`;

export const RECORD_MEETING_SUMMARY_TOOL = {
    name: 'record_meeting_summary',
    description:
        'Records the structured summary for this recording. Call this exactly once with the final summary.',
    input_schema: {
        type: 'object' as const,
        properties: {
            tldr: { type: 'string', description: '1–3 sentence summary.' },
            bullets: {
                type: 'array',
                items: { type: 'string' },
                description: '3–8 bullet points summarizing main points.',
            },
            actionItems: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        owner: { type: ['string', 'null'] },
                        text: { type: 'string' },
                        dueDate: { type: ['string', 'null'] },
                    },
                    required: ['text'],
                },
            },
            chapters: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        startSec: { type: 'number' },
                        title: { type: 'string' },
                    },
                    required: ['startSec', 'title'],
                },
            },
            keyDecisions: {
                type: 'array',
                items: { type: 'string' },
            },
        },
        required: ['tldr', 'bullets', 'actionItems', 'chapters', 'keyDecisions'],
    },
} as const;
