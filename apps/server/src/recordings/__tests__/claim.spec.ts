import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ClaimRecordingsDto } from '../dto/claim-recordings.dto';

const UUID = '3f1d2c4e-5a6b-4c8d-9e0f-1a2b3c4d5e6f';
const dto = (o: Record<string, unknown>) => plainToInstance(ClaimRecordingsDto, o);

describe('claiming guest captures', () => {
  it('accepts a claim scoped to a guest', async () => {
    expect(await validate(dto({ recordingIds: [UUID], guestId: 'g-123' }))).toHaveLength(0);
  });

  it('still accepts a claim with no guestId, for rows predating the column', async () => {
    expect(await validate(dto({ recordingIds: [UUID] }))).toHaveLength(0);
  });

  it('rejects a claim with no recording ids', async () => {
    expect(await validate(dto({ guestId: 'g-123' }))).not.toHaveLength(0);
  });

  it('rejects a non-array recordingIds', async () => {
    expect(await validate(dto({ recordingIds: UUID }))).not.toHaveLength(0);
  });

  it('rejects an id that is not a uuid', async () => {
    expect(await validate(dto({ recordingIds: ['../../etc/passwd'] }))).not.toHaveLength(0);
  });
});
