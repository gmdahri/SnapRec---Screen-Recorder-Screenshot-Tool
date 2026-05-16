import { IsBoolean } from 'class-validator';

export class UpdateTranscriptPrivacyDto {
    @IsBoolean()
    transcriptPublic: boolean;
}
