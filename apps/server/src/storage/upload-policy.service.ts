import { BadRequestException, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { StorageService } from './storage.service';

const TYPES: Record<string, string> = {
  'video/webm': 'webm', 'video/mp4': 'mp4', 'image/png': 'png',
  'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
};

/** Guest credentials are random client secrets, never returned in public metadata. */
export function uploadPrincipal(req: any): string {
  if (req.user?.id) return `user:${req.user.id}`;
  return guestPrincipal(req);
}
export function guestPrincipal(req: any): string {
  const secret = req.headers?.['x-snaprec-guest'];
  if (typeof secret !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(secret)) {
    throw new ForbiddenException('Sign in or update SnapRec to upload this capture. Local downloads remain available.');
  }
  return `guest:${createHash('sha256').update(secret).digest('hex')}`;
}

@Injectable()
export class UploadPolicyService {
  constructor(private readonly db: DataSource, private readonly storage: StorageService) {}

  async issue(req: any, contentType: string, sizeBytes: number) {
    const principal = uploadPrincipal(req);
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 536870912);
    if (!TYPES[mime] || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new BadRequestException(`Unsupported media or file larger than ${Math.floor(maxBytes / 1048576)} MB. Download locally instead.`);
    }
    if (![maxBytes, Number(process.env.UPLOAD_DAILY_COUNT || 100), Number(process.env.UPLOAD_DAILY_BYTES || 2147483648)].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid upload budget configuration');
    const key = `${randomUUID()}.${TYPES[mime]}`;
    const ip = createHash('sha256').update(req.ip || req.socket?.remoteAddress || 'unknown').digest('hex');
    const maxUploads = Number(process.env.UPLOAD_DAILY_COUNT || 100);
    const maxDailyBytes = Number(process.env.UPLOAD_DAILY_BYTES || 2147483648);
    await this.db.transaction(async manager => {
      // Shared DB locks make budgets work across Cloud Run instances.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-ip:${ip}`]);
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [principal]);
      const [usage] = await manager.query(`SELECT count(*)::int AS count, COALESCE(sum("sizeBytes"),0)::bigint AS bytes
        FROM sr_upload_grants WHERE (principal=$1 OR "ipHash"=$2) AND "createdAt">now()-interval '1 day'`, [principal, ip]);
      if (Number(usage.count) >= maxUploads || Number(usage.bytes) + sizeBytes > maxDailyBytes) {
        throw new HttpException('Daily cloud upload allowance reached. Download locally or try again tomorrow.', 429);
      }
      await manager.query(`INSERT INTO sr_upload_grants (key,principal,"ipHash","sizeBytes","contentType") VALUES ($1,$2,$3,$4,$5)`,
        [key, principal, ip, sizeBytes, mime]);
    });
    return { uploadUrl: await this.storage.getUploadPresignedUrl(key, mime, sizeBytes), fileUrl: key };
  }

  async assertOwned(key: string, principal: string) {
    const [grant] = await this.db.query('SELECT * FROM sr_upload_grants WHERE key=$1 AND principal=$2', [key, principal]);
    if (!grant) throw new ForbiddenException('This upload does not belong to you.');
    if (Date.now() - new Date(grant.createdAt).getTime() > 86400000) {
      const linked = await this.db.query('SELECT id FROM sr_recordings WHERE "fileUrl"=$1', [key]);
      if (!linked.length) throw new BadRequestException('This unfinished upload expired. Upload your local copy again.');
    }
    const actual = await this.storage.getContentLength(key);
    if (actual !== Number(grant.sizeBytes)) throw new BadRequestException('Upload is incomplete or its size does not match. Retry the upload.');
    return grant;
  }
}
