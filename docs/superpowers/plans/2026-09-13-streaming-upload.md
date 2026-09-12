# Streaming Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A recording is on R2 before the user stops recording, is in `/library` without them asking, and a failed part costs one part rather than the whole file.

**Architecture:** R2 multipart upload driven from the extension. The service worker orchestrates — it asks the server to open an upload, requests a presigned URL per part, and records ETags — while the offscreen document, which already holds the `MediaRecorder` chunks, performs each PUT itself. Bytes never cross `chrome.runtime`. Guests upload on the same path, and an unclaimed guest recording is swept an hour after its upload completes.

**Tech Stack:** NestJS + `@aws-sdk/client-s3` (R2 is S3-compatible), TypeORM migrations, Chrome MV3 classic scripts, Jest (server), Vitest (extension and web).

**Spec:** `docs/superpowers/specs/2026-09-13-streaming-upload-design.md`

## Global Constraints

- **Part size is at least 5 MB** (`PART_MIN_BYTES = 5 * 1024 * 1024`) — R2's minimum for every part except the last. At the recorder's ~2.5 Mbps default that is a part roughly every 16 seconds.
- **No `SNAPREC` message may carry more than 1 MB.** The offscreen document PUTs each part directly to R2; the service worker passes signed URLs (strings) and receives ETags (strings). Routing part bytes through the service worker rebuilds the 64 MiB failure this codebase has already had twice.
- **Media never transits the NestJS server.** It signs; the extension PUTs to R2. Same as the existing single-shot upload.
- **Guest streaming stays off until the expiry sweep exists and is verified** (Task 7). Shipping "everyone uploads" without the thing that bounds it makes storage cost unbounded and invisible until a bill arrives.
- **Unclaimed guest recordings expire one hour after upload completion**, measured from completion, not from recording start.
- **The sweep runs every 5 minutes.** A daily job is useless against a one-hour window.
- **Two manual infrastructure steps** that no code will do for you, both in the Release section: the R2 **1-day** lifecycle rule for incomplete multipart uploads, and the Cloud Scheduler job that calls the sweep.
- **Entities are registered in two places** — `app.module.ts` and `data-source.ts`. `synchronize: false` everywhere; schema changes need a generated migration and an applied migration is never edited.
- Global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted`: any request field without a matching DTO property is a 400. Add the property, do not work around it.
- Extension tests: `npm test --workspace=apps/extension`. Web: `npm test --workspace=apps/web`. Server: `npm test --workspace=apps/server`.

---

### Task 1: Part-assembly rules (pure)

When a part is ready, what number it gets, and the shape R2 wants at completion.
Extracted first because it is the only part of the uploader that can be tested
without a browser.

**Files:**
- Create: `apps/extension/background/upload-parts.core.js`
- Create: `apps/extension/background/upload-parts.js`
- Test: `apps/extension/tests/uploadParts.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces, on `globalThis.SnapRecParts` and as named ESM exports:
  - `PART_MIN_BYTES: number`
  - `createUploadState() => { parts: [], buffered: 0, nextPart: 1 }`
  - `shouldFlush(bufferedBytes: number, isFinal: boolean) => boolean`
  - `takePartNumber(state) => number` — mutates `state.nextPart`
  - `recordPart(state, { partNumber, etag }) => void`
  - `completionPayload(state) => Array<{ PartNumber: number, ETag: string }>` — ascending by PartNumber
  - `isUsable(state) => boolean` — false when no part was ever accepted

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/uploadParts.test.js`:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PART_MIN_BYTES, completionPayload, createUploadState, isUsable,
  recordPart, shouldFlush, takePartNumber,
} from '../background/upload-parts.core.js';

/** The bookkeeping a multipart upload is made of.
 *
 * R2 rejects a completion whose parts are out of order or whose non-final
 * parts are under 5 MB, and it does so at the very end — after the whole
 * recording has been uploaded. A mistake here is therefore not visible until
 * the most expensive possible moment, which is why the rules live in one
 * tested place rather than inline in the uploader. */

describe('shouldFlush', () => {
  it('holds a buffer below the minimum part size', () => {
    expect(shouldFlush(PART_MIN_BYTES - 1, false)).toBe(false);
  });

  it('flushes once the minimum is reached', () => {
    expect(shouldFlush(PART_MIN_BYTES, false)).toBe(true);
  });

  it('flushes a short final part, which is the one R2 allows', () => {
    expect(shouldFlush(1024, true)).toBe(true);
  });

  it('does not flush an empty final buffer — there is nothing to send', () => {
    expect(shouldFlush(0, true)).toBe(false);
  });
});

describe('part numbering', () => {
  it('is one-based, because R2 rejects part 0', () => {
    const s = createUploadState();
    expect(takePartNumber(s)).toBe(1);
  });

  it('never reuses a number', () => {
    const s = createUploadState();
    expect([takePartNumber(s), takePartNumber(s), takePartNumber(s)]).toEqual([1, 2, 3]);
  });
});

describe('completionPayload', () => {
  it('is empty for an upload that sent nothing', () => {
    expect(completionPayload(createUploadState())).toEqual([]);
  });

  it('uses the exact key names R2 expects', () => {
    const s = createUploadState();
    recordPart(s, { partNumber: 1, etag: '"abc"' });
    expect(completionPayload(s)).toEqual([{ PartNumber: 1, ETag: '"abc"' }]);
  });

  it('sorts ascending even when parts complete out of order', () => {
    // Uploads run concurrently, so a later part can finish first.
    const s = createUploadState();
    recordPart(s, { partNumber: 3, etag: '"c"' });
    recordPart(s, { partNumber: 1, etag: '"a"' });
    recordPart(s, { partNumber: 2, etag: '"b"' });
    expect(completionPayload(s).map((p) => p.PartNumber)).toEqual([1, 2, 3]);
  });

  it('keeps a re-uploaded part once, with the newest ETag', () => {
    // A retried part gets a fresh ETag; sending both would fail completion.
    const s = createUploadState();
    recordPart(s, { partNumber: 2, etag: '"old"' });
    recordPart(s, { partNumber: 2, etag: '"new"' });
    expect(completionPayload(s)).toEqual([{ PartNumber: 2, ETag: '"new"' }]);
  });
});

describe('isUsable', () => {
  it('is false before any part is accepted', () => {
    expect(isUsable(createUploadState())).toBe(false);
  });

  it('is true once a part is in', () => {
    const s = createUploadState();
    recordPart(s, { partNumber: 1, etag: '"a"' });
    expect(isUsable(s)).toBe(true);
  });
});

describe('the classic-script copy', () => {
  it('has not drifted from the tested module', () => {
    // Order matters: strip the whole `export { ... };` block BEFORE stripping
    // a leading `export ` keyword, or the first rule eats the keyword and
    // leaves an orphaned brace list behind.
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecParts[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../background/upload-parts.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../background/upload-parts.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/extension -- uploadParts
```

Expected: FAIL — `Failed to resolve import "../background/upload-parts.core.js"`.

- [ ] **Step 3: Write the ESM core**

Create `apps/extension/background/upload-parts.core.js`:

```js
/** The bookkeeping a multipart upload is made of.
 *
 * R2 validates the part list only at CompleteMultipartUpload — after the whole
 * recording has already been sent. An out-of-order list, a duplicated part
 * number or a non-final part under 5 MB therefore fails at the most expensive
 * possible moment, which is why these rules are here and tested rather than
 * scattered through the uploader.
 *
 * This is the ESM copy, imported only by the tests. background/upload-parts.js
 * is the classic-script twin that importScripts loads — tests/uploadParts.test.js
 * fails if the two drift. */

/** R2's minimum for every part except the last. */
const PART_MIN_BYTES = 5 * 1024 * 1024;

function createUploadState() {
  return { parts: [], buffered: 0, nextPart: 1 };
}

/** The final part is the only one allowed to be short — but an empty one is
 * not a part at all, and sending it fails the upload. */
function shouldFlush(bufferedBytes, isFinal) {
  if (bufferedBytes <= 0) return false;
  return isFinal || bufferedBytes >= PART_MIN_BYTES;
}

/** One-based: R2 rejects part number 0. */
function takePartNumber(state) {
  return state.nextPart++;
}

/** Last write wins, so a retried part replaces its own earlier ETag rather
 * than appearing twice. */
function recordPart(state, { partNumber, etag }) {
  const existing = state.parts.find((p) => p.partNumber === partNumber);
  if (existing) existing.etag = etag;
  else state.parts.push({ partNumber, etag });
}

/** Exactly the shape CompleteMultipartUpload wants, ascending. Parts upload
 * concurrently, so completion order is not part order. */
function completionPayload(state) {
  return [...state.parts]
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }));
}

function isUsable(state) {
  return state.parts.length > 0;
}

export {
  PART_MIN_BYTES, completionPayload, createUploadState, isUsable,
  recordPart, shouldFlush, takePartNumber,
};
```

- [ ] **Step 4: Write the classic-script twin**

Create `apps/extension/background/upload-parts.js` by copying the file from
Step 3 and changing only two things: the closing sentence of the header comment
to read

```
 * This is the CLASSIC-SCRIPT copy that importScripts loads — importScripts
 * cannot load an ES module, so background/upload-parts.core.js holds the
 * identical bodies for the tests. tests/uploadParts.test.js fails if the two
 * drift. */
```

and the `export { ... };` statement to

```js
// Loaded by importScripts into the service worker's global scope.
globalThis.SnapRecParts = {
  PART_MIN_BYTES, completionPayload, createUploadState, isUsable,
  recordPart, shouldFlush, takePartNumber,
};
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test --workspace=apps/extension -- uploadParts
```

Expected: PASS, 12 tests including the drift test.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/background/upload-parts.core.js \
        apps/extension/background/upload-parts.js \
        apps/extension/tests/uploadParts.test.js
git commit -m "feat(extension): part-assembly rules for multipart upload

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: StorageService learns multipart

**Files:**
- Modify: `apps/server/src/storage/storage.service.ts`
- Test: `apps/server/src/storage/__tests__/multipart.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces on `StorageService`:
  - `createMultipartUpload(fileName: string, contentType: string): Promise<string>` — the uploadId
  - `getUploadPartUrl(fileName: string, uploadId: string, partNumber: number): Promise<string>`
  - `completeMultipartUpload(fileName: string, uploadId: string, parts: Array<{ PartNumber: number, ETag: string }>): Promise<void>`
  - `abortMultipartUpload(fileName: string, uploadId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/storage/__tests__/multipart.spec.ts`:

```ts
import { StorageService } from '../storage.service';

/** The four calls that make a streamed recording possible.
 *
 * Asserted against a stubbed S3 client rather than R2 itself: what matters
 * here is that each command carries the right bucket, key and part number,
 * and that abort is reachable — an upload that is never completed or aborted
 * bills for its parts invisibly until the bucket's lifecycle rule sweeps it.
 */

const config = {
  get: (k: string) => ({
    R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET_NAME: 'bucket',
  } as Record<string, string>)[k],
} as any;

function serviceWithStub() {
  const sent: any[] = [];
  const svc = new StorageService(config);
  (svc as any).s3Client = {
    send: async (cmd: any) => {
      sent.push(cmd);
      if (cmd.constructor.name === 'CreateMultipartUploadCommand') return { UploadId: 'upl-1' };
      return {};
    },
  };
  return { svc, sent };
}

describe('multipart upload', () => {
  it('opens an upload and returns the id R2 gave it', async () => {
    const { svc, sent } = serviceWithStub();
    await expect(svc.createMultipartUpload('a.webm', 'video/webm')).resolves.toBe('upl-1');
    expect(sent[0].input).toMatchObject({
      Bucket: 'bucket', Key: 'a.webm', ContentType: 'video/webm',
    });
  });

  it('fails loudly when R2 returns no upload id', async () => {
    const { svc } = serviceWithStub();
    (svc as any).s3Client.send = async () => ({});
    await expect(svc.createMultipartUpload('a.webm', 'video/webm')).rejects.toThrow();
  });

  it('signs a part URL for the right part number', async () => {
    const { svc } = serviceWithStub();
    const url = await svc.getUploadPartUrl('a.webm', 'upl-1', 3);
    expect(url).toContain('partNumber=3');
    expect(url).toContain('uploadId=upl-1');
  });

  it('completes with the parts it is given, in order', async () => {
    const { svc, sent } = serviceWithStub();
    await svc.completeMultipartUpload('a.webm', 'upl-1', [
      { PartNumber: 1, ETag: '"a"' }, { PartNumber: 2, ETag: '"b"' },
    ]);
    expect(sent[0].input).toMatchObject({
      Bucket: 'bucket', Key: 'a.webm', UploadId: 'upl-1',
      MultipartUpload: { Parts: [{ PartNumber: 1, ETag: '"a"' }, { PartNumber: 2, ETag: '"b"' }] },
    });
  });

  it('refuses to complete an upload with no parts', async () => {
    const { svc } = serviceWithStub();
    await expect(svc.completeMultipartUpload('a.webm', 'upl-1', [])).rejects.toThrow();
  });

  it('aborts an upload, which is what stops it billing', async () => {
    const { svc, sent } = serviceWithStub();
    await svc.abortMultipartUpload('a.webm', 'upl-1');
    expect(sent[0].constructor.name).toBe('AbortMultipartUploadCommand');
    expect(sent[0].input).toMatchObject({ Bucket: 'bucket', Key: 'a.webm', UploadId: 'upl-1' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/server -- multipart
```

Expected: FAIL — `svc.createMultipartUpload is not a function`.

- [ ] **Step 3: Implement the four methods**

In `apps/server/src/storage/storage.service.ts`, extend the import:

```ts
import {
    S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand,
    CreateMultipartUploadCommand, UploadPartCommand,
    CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
```

and add these methods to the class:

```ts
    /** Opens a multipart upload and returns R2's id for it.
     *
     * From here until complete or abort, every part that lands is billed
     * storage that does not appear in a bucket listing. Nothing else in this
     * service has that property, which is why abort below is not optional. */
    async createMultipartUpload(fileName: string, contentType: string): Promise<string> {
        const result = await this.s3Client.send(new CreateMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: fileName,
            ContentType: contentType,
        }));
        if (!result.UploadId) {
            throw new Error(`R2 returned no UploadId for ${fileName}`);
        }
        this.logger.log(`Multipart upload opened for ${fileName}: ${result.UploadId}`);
        return result.UploadId;
    }

    /** A presigned URL for one part. The extension PUTs to it directly — part
     * bytes never reach this server. */
    async getUploadPartUrl(fileName: string, uploadId: string, partNumber: number): Promise<string> {
        const command = new UploadPartCommand({
            Bucket: this.bucketName,
            Key: fileName,
            UploadId: uploadId,
            PartNumber: partNumber,
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    /** Assembles the parts into the finished object.
     *
     * R2 validates the whole list here, at the end — so an empty list is
     * rejected up front rather than after a round trip. */
    async completeMultipartUpload(
        fileName: string,
        uploadId: string,
        parts: Array<{ PartNumber: number; ETag: string }>,
    ): Promise<void> {
        if (!parts.length) {
            throw new Error(`Refusing to complete ${fileName} with no parts`);
        }
        await this.s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
        }));
        this.logger.log(`Multipart upload completed for ${fileName} (${parts.length} parts)`);
    }

    /** Discards the parts. Until this runs — or the bucket's 1-day lifecycle
     * rule runs for us — they keep billing. */
    async abortMultipartUpload(fileName: string, uploadId: string): Promise<void> {
        await this.s3Client.send(new AbortMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: fileName,
            UploadId: uploadId,
        }));
        this.logger.log(`Multipart upload aborted for ${fileName}`);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/server -- multipart
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/storage/storage.service.ts \
        apps/server/src/storage/__tests__/multipart.spec.ts
git commit -m "feat(server): multipart upload support in StorageService

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The four upload endpoints

**Files:**
- Create: `apps/server/src/recordings/dto/multipart.dto.ts`
- Modify: `apps/server/src/recordings/dto/index.ts`
- Modify: `apps/server/src/recordings/recordings.controller.ts:36-44`
- Test: `apps/server/src/recordings/__tests__/multipart-dto.spec.ts`

**Interfaces:**
- Consumes: the four `StorageService` methods from Task 2.
- Produces:
  - `POST /recordings/upload/begin` `{ fileName, contentType }` → `{ uploadId }`
  - `POST /recordings/upload/part` `{ fileName, uploadId, partNumber }` → `{ uploadUrl }`
  - `POST /recordings/upload/complete` `{ fileName, uploadId, parts }` → `{ fileUrl }`
  - `POST /recordings/upload/abort` `{ fileName, uploadId }` → `{ aborted: true }`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/recordings/__tests__/multipart-dto.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  BeginUploadDto, PartUrlDto, CompleteUploadDto, AbortUploadDto,
} from '../dto/multipart.dto';

/** The global ValidationPipe runs with whitelist + forbidNonWhitelisted, so
 * these DTOs are the API surface, not a formality — an unlisted field is a
 * 400. The part list is the one worth care: R2 accepts it only at the very
 * end of an upload, so a malformed list fails after the whole recording has
 * already been sent. */

const of = <T>(cls: new () => T, o: Record<string, unknown>) => plainToInstance(cls, o);

describe('begin upload', () => {
  it('accepts a file name and content type', async () => {
    expect(await validate(of(BeginUploadDto, { fileName: 'a.webm', contentType: 'video/webm' })))
      .toHaveLength(0);
  });

  it('rejects a missing file name', async () => {
    expect(await validate(of(BeginUploadDto, { contentType: 'video/webm' }))).not.toHaveLength(0);
  });
});

describe('part url', () => {
  const ok = { fileName: 'a.webm', uploadId: 'upl-1', partNumber: 1 };

  it('accepts a one-based part number', async () => {
    expect(await validate(of(PartUrlDto, ok))).toHaveLength(0);
  });

  it('rejects part number 0, which R2 does not allow', async () => {
    expect(await validate(of(PartUrlDto, { ...ok, partNumber: 0 }))).not.toHaveLength(0);
  });

  it('rejects a part number past R2 limit of 10000', async () => {
    expect(await validate(of(PartUrlDto, { ...ok, partNumber: 10001 }))).not.toHaveLength(0);
  });
});

describe('complete upload', () => {
  const parts = [{ PartNumber: 1, ETag: '"a"' }];

  it('accepts a well-formed part list', async () => {
    expect(await validate(of(CompleteUploadDto, { fileName: 'a.webm', uploadId: 'u', parts })))
      .toHaveLength(0);
  });

  it('rejects an empty part list', async () => {
    expect(await validate(of(CompleteUploadDto, { fileName: 'a.webm', uploadId: 'u', parts: [] })))
      .not.toHaveLength(0);
  });

  it('rejects a part with no ETag', async () => {
    expect(await validate(of(CompleteUploadDto, {
      fileName: 'a.webm', uploadId: 'u', parts: [{ PartNumber: 1 }],
    }))).not.toHaveLength(0);
  });
});

describe('abort upload', () => {
  it('accepts a file name and upload id', async () => {
    expect(await validate(of(AbortUploadDto, { fileName: 'a.webm', uploadId: 'u' })))
      .toHaveLength(0);
  });

  it('rejects a missing upload id — there would be nothing to abort', async () => {
    expect(await validate(of(AbortUploadDto, { fileName: 'a.webm' }))).not.toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/server -- multipart-dto
```

Expected: FAIL — cannot find module `../dto/multipart.dto`.

- [ ] **Step 3: Write the DTOs**

Create `apps/server/src/recordings/dto/multipart.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
    ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class BeginUploadDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    contentType: string;
}

export class PartUrlDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    uploadId: string;

    /** One-based, and capped at R2's maximum of 10,000 parts per upload. */
    @IsInt()
    @Min(1)
    @Max(10000)
    partNumber: number;
}

export class UploadedPartDto {
    @IsInt()
    @Min(1)
    @Max(10000)
    PartNumber: number;

    @IsString()
    @IsNotEmpty()
    ETag: string;
}

export class CompleteUploadDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    uploadId: string;

    /** R2 validates this list only at completion — after the whole recording
     * has been uploaded — so an obviously bad list is refused here instead. */
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => UploadedPartDto)
    parts: UploadedPartDto[];
}

export class AbortUploadDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    uploadId: string;
}
```

Then add to `apps/server/src/recordings/dto/index.ts`:

```ts
export * from './multipart.dto';
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/server -- multipart-dto
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Add the endpoints**

In `apps/server/src/recordings/recordings.controller.ts`, extend the DTO import
with `BeginUploadDto, PartUrlDto, CompleteUploadDto, AbortUploadDto`, then add
directly below the existing `@Post('upload-url')` handler:

```ts
    /* ── Streaming upload ────────────────────────────────────────────────────
     * A recording is uploaded while it is still being made: the extension opens
     * an upload here, asks for a signed URL per 5 MB part, PUTs each part
     * straight to R2, and completes at the end. Part bytes never reach this
     * server — it only signs and bookkeeps. */

    @Post('upload/begin')
    async beginUpload(@Body() dto: BeginUploadDto) {
        const uploadId = await this.storageService.createMultipartUpload(
            dto.fileName, dto.contentType);
        return { uploadId };
    }

    @Post('upload/part')
    async getPartUrl(@Body() dto: PartUrlDto) {
        const uploadUrl = await this.storageService.getUploadPartUrl(
            dto.fileName, dto.uploadId, dto.partNumber);
        return { uploadUrl };
    }

    @Post('upload/complete')
    async completeUpload(@Body() dto: CompleteUploadDto) {
        await this.storageService.completeMultipartUpload(
            dto.fileName, dto.uploadId, dto.parts);
        return { fileUrl: dto.fileName };
    }

    /** Abort is what stops orphaned parts billing. It must never throw at the
     * caller: the extension calls this on cancel and on suspend, when it may
     * have milliseconds to live and no way to react to a failure. */
    @Post('upload/abort')
    async abortUpload(@Body() dto: AbortUploadDto) {
        try {
            await this.storageService.abortMultipartUpload(dto.fileName, dto.uploadId);
        } catch (e) {
            this.logger.warn(`Abort failed for ${dto.fileName}: ${(e as Error).message}`);
        }
        return { aborted: true };
    }
```

- [ ] **Step 6: Run the server suite and build**

```bash
npm test --workspace=apps/server
npm run build --workspace=apps/server
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/recordings/dto/multipart.dto.ts \
        apps/server/src/recordings/dto/index.ts \
        apps/server/src/recordings/recordings.controller.ts \
        apps/server/src/recordings/__tests__/multipart-dto.spec.ts
git commit -m "feat(server): multipart upload endpoints

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The offscreen document uploads its own parts

The recorder already holds the chunks. It buffers them into parts and PUTs each
one itself, so no part ever crosses `chrome.runtime`.

**Files:**
- Modify: `apps/extension/offscreen/offscreen.js` — `ondataavailable`, plus three message cases
- Modify: `apps/extension/offscreen/offscreen.html` — load `upload-parts.js`

**Interfaces:**
- Consumes: `SnapRecParts.PART_MIN_BYTES`, `shouldFlush` (Task 1).
- Produces, as offscreen message actions:
  - `offscreen_streamBegin {}` → `{ success }` — start buffering for upload
  - `offscreen_streamTakePart { isFinal: boolean }` → `{ success, hasPart: boolean, bytes: number }` — moves the buffer into a pending part
  - `offscreen_streamPutPart { uploadUrl: string }` → `{ success, etag: string }` — PUTs the pending part
  - The service worker learns a part is ready via `{ action: 'streamPartReady', bytes }` sent from here.

- [ ] **Step 1: Load the part rules into the offscreen document**

In `apps/extension/offscreen/offscreen.html`, add before the `offscreen.js`
script tag:

```html
<script src="../background/upload-parts.js"></script>
```

- [ ] **Step 2: Add the buffering state and handlers**

In `apps/extension/offscreen/offscreen.js`, add near the other module state:

```js
/** Chunks waiting to become the next upload part.
 *
 * Separate from recordedChunks, which is the whole recording and is still what
 * the local blob and the handoff are built from. This buffer is drained as it
 * fills; the recording itself is untouched by uploading. */
let streamBuffer = [];
let streamBufferedBytes = 0;
let streamPendingPart = null;
let streaming = false;
```

Add these cases to the message switch, after `offscreen_getBlobUrl`:

```js
        case 'offscreen_streamBegin':
            streamBuffer = [];
            streamBufferedBytes = 0;
            streamPendingPart = null;
            streaming = true;
            sendResponse({ success: true });
            return false;

        case 'offscreen_streamTakePart': {
            if (!globalThis.SnapRecParts.shouldFlush(streamBufferedBytes, !!message.isFinal)) {
                sendResponse({ success: true, hasPart: false, bytes: 0 });
                return false;
            }
            streamPendingPart = new Blob(streamBuffer, { type: 'application/octet-stream' });
            const bytes = streamPendingPart.size;
            streamBuffer = [];
            streamBufferedBytes = 0;
            sendResponse({ success: true, hasPart: true, bytes });
            return false;
        }

        case 'offscreen_streamPutPart':
            putPendingPart(message.uploadUrl)
                .then(etag => sendResponse({ success: true, etag }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
```

- [ ] **Step 3: Feed the buffer and report readiness**

In `apps/extension/offscreen/offscreen.js`, replace the `ondataavailable`
handler inside `startMediaRecorder`:

```js
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
            if (streaming) {
                streamBuffer.push(e.data);
                streamBufferedBytes += e.data.size;
                // The service worker owns the upload; it only needs to know a
                // part's worth has accumulated. The bytes stay here.
                if (streamBufferedBytes >= globalThis.SnapRecParts.PART_MIN_BYTES) {
                    chrome.runtime.sendMessage({
                        action: 'streamPartReady', bytes: streamBufferedBytes,
                    }).catch(() => { /* worker asleep; the next chunk retries */ });
                }
            }
        }
    };
```

- [ ] **Step 4: Implement the PUT**

Add above `async function cropImage(`:

```js
/** PUTs the pending part straight to R2.
 *
 * This function existing here is the whole design: the part is several
 * megabytes and it never enters a chrome.runtime message. The service worker
 * sends a signed URL — a string — and gets back an ETag — a string.
 *
 * The ETag is quoted by R2 and must be handed back to CompleteMultipartUpload
 * exactly as received, quotes included. */
async function putPendingPart(uploadUrl) {
    if (!streamPendingPart) throw new Error('No part pending');

    const response = await fetch(uploadUrl, { method: 'PUT', body: streamPendingPart });
    if (!response.ok) throw new Error(`Part upload failed: HTTP ${response.status}`);

    const etag = response.headers.get('ETag');
    if (!etag) throw new Error('R2 returned no ETag for the part');

    streamPendingPart = null;
    console.log('[Offscreen] Part uploaded,', etag);
    return etag;
}
```

- [ ] **Step 5: Check the syntax**

```bash
node --check apps/extension/offscreen/offscreen.js
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/offscreen/offscreen.js apps/extension/offscreen/offscreen.html
git commit -m "feat(extension): buffer and PUT upload parts from the offscreen document

Part bytes never cross chrome.runtime — the worker passes a signed URL
and receives an ETag.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The service worker drives the upload

**Files:**
- Modify: `apps/extension/background/background.js:1-12` — `importScripts`
- Modify: `apps/extension/background/background.js` — `startRecording`, `stopRecording`, plus a new uploader section
- Modify: `apps/extension/background/storage.js` — `beginStreamingUpload` helpers

**Interfaces:**
- Consumes: `SnapRecParts.*` (Task 1); the four endpoints (Task 3); the three offscreen actions (Task 4).
- Produces: `streamingUpload` module state plus `startStreamingUpload()`, `uploadNextPart()`, `finishStreamingUpload()`, `abortStreamingUpload()`; a `streamPartReady` message handler.

- [ ] **Step 1: Load the part rules into the service worker**

In `apps/extension/background/background.js`, add after the `fullpage.js` line:

```js
importScripts('upload-parts.js');
```

- [ ] **Step 2: Add the uploader**

Add above `async function handleRecordingComplete()`:

```js
/** The streaming upload in flight, or null.
 *
 * Only one recording runs at a time, so one slot is enough. Held in the worker
 * rather than the offscreen document because the worker is what talks to the
 * API — and because the offscreen document is closed at the end of a
 * recording, while completing the upload may outlive it. */
let streamingUpload = null;

/** Opens the upload. Failure here is not fatal: the recording continues and
 * falls back to the existing upload-on-demand path. */
async function startStreamingUpload() {
    try {
        const fileName = `video-${crypto.randomUUID()}-${Date.now()}.webm`;
        const res = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload/begin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, contentType: 'video/webm' }),
        });
        if (!res.ok) throw new Error(`begin failed: HTTP ${res.status}`);

        const { uploadId } = await res.json();
        streamingUpload = {
            fileName, uploadId, state: SnapRecParts.createUploadState(), busy: false,
        };
        await chrome.runtime.sendMessage({ action: 'offscreen_streamBegin' });
        console.log('[SnapRec] Streaming upload opened:', fileName);
    } catch (e) {
        console.warn('[SnapRec] Could not open streaming upload:', e.message);
        streamingUpload = null;
    }
}

/** Uploads one part if one is ready.
 *
 * Serialised by `busy`: parts must not be taken concurrently, because
 * offscreen_streamTakePart drains a single shared buffer. */
async function uploadNextPart(isFinal = false) {
    if (!streamingUpload || streamingUpload.busy) return;
    streamingUpload.busy = true;
    try {
        const taken = await chrome.runtime.sendMessage({
            action: 'offscreen_streamTakePart', isFinal,
        });
        if (!taken?.success || !taken.hasPart) return;

        const partNumber = SnapRecParts.takePartNumber(streamingUpload.state);
        const res = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload/part`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: streamingUpload.fileName,
                uploadId: streamingUpload.uploadId,
                partNumber,
            }),
        });
        if (!res.ok) throw new Error(`part url failed: HTTP ${res.status}`);

        const { uploadUrl } = await res.json();
        const put = await chrome.runtime.sendMessage({
            action: 'offscreen_streamPutPart', uploadUrl,
        });
        if (!put?.success) throw new Error(put?.error ?? 'part PUT failed');

        SnapRecParts.recordPart(streamingUpload.state, { partNumber, etag: put.etag });
        console.log('[SnapRec] Part', partNumber, 'uploaded,', taken.bytes, 'bytes');
    } catch (e) {
        console.warn('[SnapRec] Part upload failed:', e.message);
    } finally {
        if (streamingUpload) streamingUpload.busy = false;
    }
}

/** Drains the last part and completes. Returns the fileUrl, or null. */
async function finishStreamingUpload() {
    if (!streamingUpload) return null;
    await uploadNextPart(true);

    const upload = streamingUpload;
    streamingUpload = null;

    if (!SnapRecParts.isUsable(upload.state)) {
        console.warn('[SnapRec] No parts uploaded; aborting');
        await abortUpload(upload);
        return null;
    }

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/recordings/upload/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: upload.fileName,
                uploadId: upload.uploadId,
                parts: SnapRecParts.completionPayload(upload.state),
            }),
        });
        if (!res.ok) throw new Error(`complete failed: HTTP ${res.status}`);
        const { fileUrl } = await res.json();
        console.log('[SnapRec] Streaming upload complete:', fileUrl);
        return fileUrl;
    } catch (e) {
        console.error('[SnapRec] Could not complete upload:', e.message);
        await abortUpload(upload);
        return null;
    }
}

/** Abort is what stops orphaned parts billing. Best-effort by design: the
 * bucket's 1-day lifecycle rule is the backstop for the cases where this
 * cannot run at all. */
async function abortUpload(upload) {
    try {
        await fetch(`${CONFIG.API_BASE_URL}/recordings/upload/abort`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: upload.fileName, uploadId: upload.uploadId }),
        });
    } catch (e) {
        console.warn('[SnapRec] Abort request failed:', e.message);
    }
}

async function abortStreamingUpload() {
    if (!streamingUpload) return;
    const upload = streamingUpload;
    streamingUpload = null;
    await abortUpload(upload);
}
```

- [ ] **Step 3: React to a part becoming ready**

In the consolidated message switch in `apps/extension/background/background.js`,
add after `case 'captureFullPage':`:

```js
        case 'streamPartReady':
            void uploadNextPart(false);
            return false;
```

- [ ] **Step 4: Open the upload when recording starts**

In `startRecording`, immediately after the `recorderResponse?.success` check
opens (right after `console.log('[SnapRec] Recording started at:', ...)`), add:

```js
                // Upload as we record. Not awaited: a slow or failed open must
                // never delay the recorder, and the fallback path still works.
                void startStreamingUpload();
```

- [ ] **Step 5: Complete on stop, abort on cancel and suspend**

In `handleRecordingComplete`, immediately after the `const recordingId = crypto.randomUUID();`
line, add:

```js
        // Drain the last part and close the upload. By now most of the file is
        // already on R2, so this is one short part plus a completion call.
        const streamedFileUrl = await finishStreamingUpload();
        if (streamedFileUrl) {
            console.log('[SnapRec] Recording already on R2 as', streamedFileUrl);
        }
```

Then in `apps/extension/background/background.js`, add near the other
lifecycle listeners:

```js
/* A recording that is cancelled, or a worker that is going away, leaves parts
 * on R2 that bill until something discards them. */
chrome.runtime.onSuspend.addListener(() => { void abortStreamingUpload(); });
```

and in the `case 'cancelCountdown':` handler body, add `void abortStreamingUpload();`.

- [ ] **Step 6: Check the syntax and run the suite**

```bash
node --check apps/extension/background/background.js
npm test --workspace=apps/extension
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/background/background.js
git commit -m "feat(extension): drive a multipart upload while recording

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Guest recordings carry an expiry

**Files:**
- Modify: `apps/server/src/recordings/entities/recording.entity.ts`
- Create: `apps/server/src/migrations/1775000006000-AddRecordingExpiry.ts`
- Test: `apps/server/src/recordings/__tests__/expiry.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Recording.expiresAt: Date | null`, and `expiresAtForUpload(hasUser: boolean, now: Date) => Date | null` exported from `apps/server/src/recordings/expiry.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/recordings/__tests__/expiry.spec.ts`:

```ts
import { GUEST_TTL_MS, expiresAtForUpload } from '../expiry';

/** The rule that bounds the cost of anonymous use.
 *
 * An unclaimed guest recording is deleted an hour after its upload finishes.
 * Measured from completion rather than from when recording started, so a
 * fifty-minute recording still gets its full hour rather than ten minutes. */

const now = new Date('2026-09-13T12:00:00.000Z');

describe('expiresAtForUpload', () => {
  it('gives a guest recording one hour', () => {
    expect(expiresAtForUpload(false, now)?.toISOString()).toBe('2026-09-13T13:00:00.000Z');
  });

  it('gives a signed-in recording no expiry at all', () => {
    expect(expiresAtForUpload(true, now)).toBeNull();
  });

  it('measures from the moment it is called, which is upload completion', () => {
    const later = new Date('2026-09-13T12:50:00.000Z');
    expect(expiresAtForUpload(false, later)?.toISOString()).toBe('2026-09-13T13:50:00.000Z');
  });

  it('uses a one-hour window', () => {
    expect(GUEST_TTL_MS).toBe(60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/server -- expiry
```

Expected: FAIL — cannot find module `../expiry`.

- [ ] **Step 3: Write the rule**

Create `apps/server/src/recordings/expiry.ts`:

```ts
/** How long an unclaimed guest recording survives.
 *
 * One hour, measured from upload completion rather than from the start of
 * recording — a fifty-minute recording would otherwise get ten minutes. A
 * guest cannot share or download without signing in, and signing in claims the
 * recording and clears this, so the window only ever affects a capture that
 * nobody but its creator can reach.
 */
export const GUEST_TTL_MS = 60 * 60 * 1000;

export function expiresAtForUpload(hasUser: boolean, now: Date = new Date()): Date | null {
    return hasUser ? null : new Date(now.getTime() + GUEST_TTL_MS);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/server -- expiry
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Add the column**

In `apps/server/src/recordings/entities/recording.entity.ts`, add beside the
other nullable columns:

```ts
    /** Set on guest uploads, cleared when the recording is claimed. A row past
     * this is deleted by the sweep along with its R2 object. */
    @Column({ type: 'timestamptz', nullable: true })
    expiresAt: Date | null;
```

Create `apps/server/src/migrations/1775000006000-AddRecordingExpiry.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecordingExpiry1775000006000 implements MigrationInterface {
    name = 'AddRecordingExpiry1775000006000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "recordings" ADD "expiresAt" TIMESTAMP WITH TIME ZONE`);
        // The sweep runs every five minutes and asks only "what is past due",
        // so the index is on the column alone. Partial, because the vast
        // majority of rows are claimed and have NULL here.
        await queryRunner.query(
            `CREATE INDEX "IDX_recordings_expiresAt" ON "recordings" ("expiresAt") ` +
            `WHERE "expiresAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_recordings_expiresAt"`);
        await queryRunner.query(`ALTER TABLE "recordings" DROP COLUMN "expiresAt"`);
    }
}
```

- [ ] **Step 6: Apply the migration and run the suite**

```bash
npm run migration:run --workspace=apps/server
npm test --workspace=apps/server
```

Expected: the migration applies, tests PASS. `migration:run` reads `.env` and
needs a working DB connection from your shell.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/recordings/expiry.ts \
        apps/server/src/recordings/entities/recording.entity.ts \
        apps/server/src/migrations/1775000006000-AddRecordingExpiry.ts \
        apps/server/src/recordings/__tests__/expiry.spec.ts
git commit -m "feat(server): guest recordings carry a one-hour expiry

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The sweep, and claiming that clears the expiry

**Files:**
- Modify: `apps/server/src/recordings/recordings.service.ts` — set on create, clear on claim, add `sweepExpired`
- Modify: `apps/server/src/recordings/recordings.controller.ts` — the sweep endpoint
- Test: `apps/server/src/recordings/__tests__/sweep.spec.ts`

**Interfaces:**
- Consumes: `expiresAtForUpload`, `GUEST_TTL_MS` (Task 6); `StorageService.deleteObject`, which exists but is **not currently injected into `RecordingsService`** — this task adds it as the last constructor parameter.
- Produces: `RecordingsService.sweepExpired(now?: Date) => Promise<{ deleted: number }>` and `POST /recordings/sweep-expired` guarded by the `x-sweep-secret` header matching `SWEEP_SECRET`.

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/recordings/__tests__/sweep.spec.ts`:

```ts
import { RecordingsService } from '../recordings.service';

/** The job that bounds anonymous storage cost.
 *
 * If this silently stops working, nothing breaks visibly — guest recordings
 * simply accumulate and bill. These tests pin the two things that would make
 * it useless: deleting the R2 object as well as the row, and never touching a
 * recording that has been claimed. */

function serviceWithRows(rows: any[]) {
  const deletedKeys: string[] = [];
  const removed: any[] = [];
  const repo = {
    find: async () => rows,
    remove: async (r: any[]) => { removed.push(...r); return r; },
  };
  const storage = { deleteObject: async (k: string) => { deletedKeys.push(k); } };
  // Positional, matching the constructor exactly: recordings, reactions,
  // comments, views, usersService, storageService. Only the first and last
  // are exercised here.
  const svc = new RecordingsService(
    repo as any, {} as any, {} as any, {} as any, {} as any, storage as any);
  return { svc, deletedKeys, removed };
}

describe('sweepExpired', () => {
  it('deletes the R2 object as well as the row', async () => {
    const { svc, deletedKeys, removed } = serviceWithRows([
      { id: 'r1', fileUrl: 'video-1.webm', expiresAt: new Date('2026-01-01') },
    ]);
    const result = await svc.sweepExpired(new Date('2026-01-02'));
    expect(result.deleted).toBe(1);
    expect(deletedKeys).toEqual(['video-1.webm']);
    expect(removed).toHaveLength(1);
  });

  it('reports zero when nothing is due', async () => {
    const { svc, deletedKeys } = serviceWithRows([]);
    expect((await svc.sweepExpired(new Date())).deleted).toBe(0);
    expect(deletedKeys).toEqual([]);
  });

  it('still removes the row when the R2 object is already gone', async () => {
    // An object deleted by hand, or a failed upload, must not wedge the sweep.
    const { svc, removed } = serviceWithRows([
      { id: 'r1', fileUrl: 'missing.webm', expiresAt: new Date('2026-01-01') },
    ]);
    (svc as any).storageService.deleteObject = async () => { throw new Error('404'); };
    expect((await svc.sweepExpired(new Date('2026-01-02'))).deleted).toBe(1);
    expect(removed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/server -- sweep
```

Expected: FAIL — `svc.sweepExpired is not a function`.

- [ ] **Step 3: Implement the sweep**

**First, inject StorageService.** `RecordingsService` does not currently
receive it — only the controller does — so the sweep has nothing to delete R2
objects with. `RecordingsModule` already imports `StorageModule`, so this needs
no module change. Add to the end of the constructor parameter list in
`apps/server/src/recordings/recordings.service.ts`, after `usersService`:

```ts
        private readonly storageService: StorageService,
```

and import it:

```ts
import { StorageService } from '../storage/storage.service';
```

Adding it last keeps every existing positional construction valid.

Then import `import { LessThan } from 'typeorm';` and
`import { expiresAtForUpload } from './expiry';`, and add:

```ts
    /** Deletes guest recordings nobody claimed.
     *
     * Runs every five minutes against a one-hour window. A failure to remove
     * the R2 object must not stop the row going: a stuck sweep would let rows
     * accumulate silently, which is exactly what this exists to prevent. */
    async sweepExpired(now: Date = new Date()): Promise<{ deleted: number }> {
        const due = await this.recordingsRepository.find({
            where: { expiresAt: LessThan(now) },
        });
        if (!due.length) return { deleted: 0 };

        for (const recording of due) {
            try {
                await this.storageService.deleteObject(recording.fileUrl);
            } catch (e) {
                this.logger.warn(
                    `Sweep: could not delete ${recording.fileUrl}: ${(e as Error).message}`);
            }
        }
        await this.recordingsRepository.remove(due);
        return { deleted: due.length };
    }
```

In `create`, set the expiry for guests — find where the entity is built and add
`expiresAt` alongside the other fields:

```ts
            // A guest upload is temporary until somebody claims it.
            expiresAt: expiresAtForUpload(Boolean(createRecordingDto.userId)),
```

In the claim method, clear it on the rows being transferred by adding
`expiresAt: null` to the fields already being updated alongside the new owner.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/server -- sweep
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Add the sweep endpoint**

In `apps/server/src/recordings/recordings.controller.ts`, add:

```ts
    /** Called by Cloud Scheduler every five minutes.
     *
     * Guarded by a shared secret rather than a user token: there is no user.
     * Cloud Run scales to zero, so an in-process cron would simply not run —
     * the schedule has to come from outside. */
    @Post('sweep-expired')
    async sweepExpired(@Req() req: any) {
        const expected = process.env.SWEEP_SECRET;
        if (!expected || req.headers['x-sweep-secret'] !== expected) {
            throw new NotFoundException();
        }
        const result = await this.recordingsService.sweepExpired();
        if (result.deleted) this.logger.log(`Sweep deleted ${result.deleted} expired recordings`);
        return result;
    }
```

Add `SWEEP_SECRET=` to `apps/server/.env.example` with the comment
`# shared secret for the expired-recording sweep; must match the Cloud Scheduler job`.

- [ ] **Step 6: Run the server suite and build**

```bash
npm test --workspace=apps/server && npm run build --workspace=apps/server
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/recordings/recordings.service.ts \
        apps/server/src/recordings/recordings.controller.ts \
        apps/server/src/recordings/__tests__/sweep.spec.ts \
        apps/server/.env.example
git commit -m "feat(server): sweep unclaimed guest recordings every five minutes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Tell the guest their recording is temporary

**Files:**
- Create: `apps/web/src/lib/expiryCountdown.ts`
- Test: `apps/web/src/__tests__/expiryCountdown.test.ts`
- Modify: `apps/web/src/pages/ShareView.tsx` — render the notice

**Interfaces:**
- Consumes: `recording.expiresAt` from the API.
- Produces: `describeExpiry(expiresAt: string | null | undefined, now: Date) => { expired: boolean; text: string } | null`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/expiryCountdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeExpiry } from '../lib/expiryCountdown';

/** The only warning a guest gets before their recording is deleted.
 *
 * A bare timer is not enough when the consequence is permanent and the remedy
 * is one click, so this produces words. The recording cannot be shared or
 * downloaded until the user signs in, and signing in claims it — so this text
 * is the whole of the guest's notice. */

const now = new Date('2026-09-13T12:00:00.000Z');

describe('describeExpiry', () => {
  it('says nothing for a claimed recording', () => {
    expect(describeExpiry(null, now)).toBeNull();
    expect(describeExpiry(undefined, now)).toBeNull();
  });

  it('counts down in whole minutes', () => {
    expect(describeExpiry('2026-09-13T12:42:00.000Z', now))
      .toEqual({ expired: false, text: 'This recording deletes in 42 minutes unless you sign in' });
  });

  it('uses the singular at one minute', () => {
    expect(describeExpiry('2026-09-13T12:01:00.000Z', now).text)
      .toBe('This recording deletes in 1 minute unless you sign in');
  });

  it('says less than a minute rather than rounding to zero', () => {
    expect(describeExpiry('2026-09-13T12:00:30.000Z', now).text)
      .toBe('This recording deletes in less than a minute unless you sign in');
  });

  it('reports an elapsed deadline as expired', () => {
    expect(describeExpiry('2026-09-13T11:59:00.000Z', now))
      .toEqual({ expired: true, text: 'This recording has expired' });
  });

  it('ignores a malformed date rather than showing nonsense', () => {
    expect(describeExpiry('not-a-date', now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/web -- expiryCountdown
```

Expected: FAIL — cannot resolve `../lib/expiryCountdown`.

- [ ] **Step 3: Write it**

Create `apps/web/src/lib/expiryCountdown.ts`:

```ts
/** Turns an expiry timestamp into the sentence a guest needs to read.
 *
 * Words rather than a bare timer: the consequence is permanent deletion and
 * the remedy is signing in, and a lone countdown communicates neither. */

export function describeExpiry(
    expiresAt: string | null | undefined,
    now: Date = new Date(),
): { expired: boolean; text: string } | null {
    if (!expiresAt) return null;

    const deadline = new Date(expiresAt).getTime();
    if (Number.isNaN(deadline)) return null;

    const remainingMs = deadline - now.getTime();
    if (remainingMs <= 0) return { expired: true, text: 'This recording has expired' };

    const minutes = Math.floor(remainingMs / 60000);
    const when = minutes < 1 ? 'less than a minute'
        : minutes === 1 ? '1 minute'
        : `${minutes} minutes`;

    return { expired: false, text: `This recording deletes in ${when} unless you sign in` };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/web -- expiryCountdown
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Render the notice**

In `apps/web/src/pages/ShareView.tsx`, add the import:

```ts
import { describeExpiry } from '../lib/expiryCountdown';
```

Add beside the other state, so the countdown ticks:

```ts
    /* Re-rendered every 30s so the countdown stays honest without a timer for
     * every second. Only runs while there is something to count down. */
    const [expiryNow, setExpiryNow] = useState(() => new Date());
    useEffect(() => {
        if (!recording?.expiresAt) return;
        const t = setInterval(() => setExpiryNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, [recording?.expiresAt]);
    const expiry = describeExpiry(recording?.expiresAt, expiryNow);
```

Then render it immediately above the primary action row:

```tsx
                {expiry && (
                    <div className="mb-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-strong)] bg-[var(--sr-surface-raised)] px-4 py-3">
                        <p className="text-[13px] text-[var(--sr-text-strong-on-light)]">{expiry.text}</p>
                        {!expiry.expired && !user && (
                            <button
                                type="button"
                                className="mt-2 text-[13px] underline"
                                onClick={() => { setLoginAction('keep this recording'); setIsLoginModalOpen(true); }}
                            >
                                Sign in to keep it
                            </button>
                        )}
                    </div>
                )}
```

- [ ] **Step 6: Run the web suite and build**

```bash
npm test --workspace=apps/web && npm run build --workspace=apps/web
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/expiryCountdown.ts \
        apps/web/src/__tests__/expiryCountdown.test.ts \
        apps/web/src/pages/ShareView.tsx
git commit -m "feat(web): tell a guest when their recording will be deleted

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Browser acceptance run

Every acceptance criterion in the spec, against real Chrome and a real R2
bucket. Unit tests cover the arithmetic and the DTOs; nothing below can be
checked without actually uploading.

**Files:** no source changes. Verification only.

- [ ] **Step 1: Point the extension at local services**

In `apps/extension/background/config.js`, swap to the commented-out localhost
lines. Start both services:

```bash
npm run start:dev --workspace=apps/server
npm run dev --workspace=apps/web
```

**Restore `config.js` with `git checkout apps/extension/background/config.js`
when this task is finished.**

- [ ] **Step 2: Check A1, A5 and A7 — a recording uploads as it is made**

Load the extension unpacked, record for **three minutes**, then stop. In the
service worker console:

| Expect | Why |
|---|---|
| `Part 1 uploaded`, `Part 2 uploaded`, … **during** recording | A1 — parts go up before stop |
| `Streaming upload complete:` within seconds of stopping | A1 |
| no "exceeded maximum allowed size" anywhere | A5 |
| nothing new in `~/Downloads/SnapRec/` | A7 |

- [ ] **Step 3: Check A2 — a network drop loses nothing**

Record for four minutes. At the two-minute mark, set DevTools → Network →
Offline for 60 seconds, then restore. The recording must complete, the upload
must finish, and the played-back file must contain the full four minutes.

- [ ] **Step 4: Check A3 — it appears without being asked for**

After Step 2, open `/library` **without** clicking "Create share link". The
recording must be listed.

- [ ] **Step 5: Check A4 — a cancelled recording leaves no orphan**

Start a recording, let it run past two parts, then cancel it. Then:

```bash
npx --yes @aws-sdk/client-s3 >/dev/null 2>&1 || true
node -e "
const {S3Client,ListMultipartUploadsCommand}=require('@aws-sdk/client-s3');
const c=new S3Client({region:'auto',forcePathStyle:true,
  endpoint:'https://'+process.env.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com',
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
c.send(new ListMultipartUploadsCommand({Bucket:process.env.R2_BUCKET_NAME}))
 .then(r=>console.log('pending uploads:',(r.Uploads||[]).length, (r.Uploads||[]).map(u=>u.Key)));
"
```

Run it from `apps/server` with the env loaded. Expected: `pending uploads: 0`.

- [ ] **Step 6: Check A6 and A8 — expiry and claim**

1. Record while **signed out**. Confirm the row has a non-null `expiresAt` about
   an hour ahead, and `/v/:id` shows "deletes in 59 minutes unless you sign in".
2. Sign in and claim it. `expiresAt` must become null and the notice must go.
3. Record signed out again, then set that row's `expiresAt` to a past time and
   call the sweep:

```bash
curl -X POST http://localhost:3001/recordings/sweep-expired \
     -H "x-sweep-secret: $SWEEP_SECRET"
```

Expected: `{"deleted":1}`, the R2 object gone, and `/v/:id` for it answering
cleanly rather than erroring.

- [ ] **Step 7: Restore config and record the results**

```bash
git checkout apps/extension/background/config.js
```

Append a results table to the spec under a `## Verification` heading naming the
Chrome version, the recording lengths, and the observed part count and timings.
Commit:

```bash
git add docs/superpowers/specs/2026-09-13-streaming-upload-design.md
git commit -m "docs: record streaming upload acceptance results

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Release

These two are **configuration, not code**. Nothing in this plan does them for
you, and both fail silently and expensively if skipped.

- [ ] **R2 lifecycle rule.** On the recordings bucket, add a rule to **abort
      incomplete multipart uploads after 1 day**. This is the backstop for
      crashes and closed browsers, where the extension was never alive to call
      abort. Without it, every interrupted recording leaves parts that bill
      forever and never appear in a bucket listing.
- [ ] **Cloud Scheduler job.** Every 5 minutes, `POST` to
      `/recordings/sweep-expired` with the `x-sweep-secret` header set to
      `SWEEP_SECRET`. Cloud Run scales to zero, so an in-process cron would
      simply not run. Without this, guest recordings never expire.
- [ ] Set `SWEEP_SECRET` in the Cloud Run service configuration.
- [ ] Apply the migration against production: `npm run migration:run`.
- [ ] Deploy the server before the extension — the extension calls endpoints
      that must already exist.
- [ ] `./ship-to-store.sh` from `apps/extension`, then bump
      `apps/web/public/version.json` once the new version is live.

## Sequencing note

Tasks 1–5 are independently shippable: they give signed-in and guest users
streaming upload, with no expiry. **Do not ship Tasks 1–5 to guests without
Tasks 6–8.** Until the sweep exists, every anonymous recording is kept forever,
and the cost of that is invisible until a bill arrives. If Tasks 6–8 will not
land in the same release, gate `startStreamingUpload` on there being a signed-in
user first.
