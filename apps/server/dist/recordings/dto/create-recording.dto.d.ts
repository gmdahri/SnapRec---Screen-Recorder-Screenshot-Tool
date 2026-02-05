export declare class CreateRecordingDto {
    title: string;
    fileUrl: string;
    type: 'video' | 'screenshot';
    userId?: string;
    guestId?: string;
}
