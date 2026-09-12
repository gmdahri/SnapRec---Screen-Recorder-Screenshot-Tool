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

/** How many bytes to take as the next part, or 0 for none.
 *
 * R2 is stricter than S3: every non-trailing part must be EXACTLY the same
 * length, not merely at least 5 MB, and it reports a violation as InvalidPart
 * at CompleteMultipartUpload — after the entire recording has been uploaded.
 * So a part is sliced to exactly PART_MIN_BYTES and the remainder stays
 * buffered; the trailing part is the only one allowed to differ. */
function partSliceLength(bufferedBytes, isFinal) {
  if (bufferedBytes <= 0) return 0;
  if (isFinal) return bufferedBytes;
  return bufferedBytes >= PART_MIN_BYTES ? PART_MIN_BYTES : 0;
}

export {
  PART_MIN_BYTES, completionPayload, createUploadState, isUsable, partSliceLength,
  recordPart, shouldFlush, takePartNumber,
};
