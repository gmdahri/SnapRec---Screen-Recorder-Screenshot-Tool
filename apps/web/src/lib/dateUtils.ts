/**
 * Parses a date string ensuring it's treated as UTC if no timezone is specified.
 * This prevents browsers from interpreting UTC database timestamps as local time.
 */
export const parseUTCDate = (dateStr: string | undefined | null): Date => {
    if (!dateStr) return new Date();
    return new Date(dateStr);
};

/**
 * Formats a date string into a relative "time ago" string or a local date.
 */
export const formatRelativeTime = (dateStr: string): string => {
    const date = parseUTCDate(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
};
