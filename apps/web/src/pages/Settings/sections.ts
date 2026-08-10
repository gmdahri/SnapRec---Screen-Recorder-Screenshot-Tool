/** The seven sections, in the order scene SETT fixes.
 *
 * Data rather than JSX so the order, the help copy and the extension-ownership
 * flags are testable — and so a setting cannot be added without deciding
 * whether it needs an explanation. */

export type FieldKind = 'choice' | 'switch' | 'text' | 'select' | 'action';

export interface SettingField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Shown under the label. Present whenever the cost or effect of a setting
   * is not obvious from its name. */
  help?: string;
  options?: string[];
  defaultValue?: string | boolean;
}

export interface SettingSection {
  title: string;
  /** Set when the extension, not the web app, owns these values. */
  note?: string;
  destructive?: boolean;
  fields: SettingField[];
}

export const SECTIONS: SettingSection[] = [
  {
    title: 'Capture defaults',
    note: 'used by the extension',
    fields: [
      {
        key: 'quality', label: 'Recording quality', kind: 'choice',
        help: 'Higher quality means larger files and slower uploads.',
        options: ['720p', '1080p', '1440p'], defaultValue: '1080p',
      },
      { key: 'fps', label: 'Frame rate', kind: 'choice', options: ['24', '30', '60'], defaultValue: '30' },
      {
        key: 'countdown', label: 'Countdown before recording', kind: 'choice',
        help: 'Gives you a moment to switch tabs.',
        options: ['0', '3', '5'], defaultValue: '3',
      },
      {
        key: 'autoZoom', label: 'Zoom in on clicks', kind: 'switch',
        help: 'Adds a zoom region wherever you click. You can remove them in the editor.',
        defaultValue: true,
      },
      { key: 'cursor', label: 'Show the cursor', kind: 'switch', defaultValue: true },
      { key: 'highlightClicks', label: 'Highlight clicks', kind: 'switch', defaultValue: false },
    ],
  },
  {
    title: 'Microphone and camera',
    note: 'used by the extension',
    fields: [
      { key: 'defaultMic', label: 'Default microphone', kind: 'select', defaultValue: 'System default' },
      { key: 'defaultCamera', label: 'Default camera', kind: 'select', defaultValue: 'None' },
      {
        key: 'micTest', label: 'Test the microphone', kind: 'action',
        help: 'Plays back two seconds so you can hear the level before recording.',
      },
    ],
  },
  {
    title: 'Sharing and privacy',
    fields: [
      {
        key: 'defaultVisibility', label: 'New links are visible to', kind: 'choice',
        help: 'Applies to links you create from now on; existing links keep their setting.',
        options: ['Anyone with the link', 'Only people I invite'],
        defaultValue: 'Anyone with the link',
      },
      { key: 'allowDownload', label: 'Allow viewers to download', kind: 'switch', defaultValue: true },
      { key: 'allowComments', label: 'Allow comments', kind: 'switch', defaultValue: true },
    ],
  },
  {
    title: 'Notifications',
    fields: [
      { key: 'emailComments', label: 'Email me about new comments', kind: 'switch', defaultValue: true },
      { key: 'emailAccess', label: 'Email me about access requests', kind: 'switch', defaultValue: true },
      {
        key: 'emailDigest', label: 'Weekly summary', kind: 'switch',
        help: 'One email on Mondays with views and replies from the previous week.',
        defaultValue: false,
      },
    ],
  },
  {
    title: 'Storage and downloads',
    fields: [
      {
        key: 'keepLocal', label: 'Keep a copy on this device after uploading', kind: 'switch',
        help: 'Uses disk space, but means a failed upload never costs you the recording.',
        defaultValue: true,
      },
      { key: 'downloadFormat', label: 'Download format', kind: 'choice', options: ['MP4', 'WebM'], defaultValue: 'MP4' },
    ],
  },
  {
    title: 'Connected apps',
    fields: [
      {
        key: 'googleDrive', label: 'Google Drive', kind: 'action',
        help: 'Save a copy of every upload to a folder you choose.',
      },
    ],
  },
  {
    title: 'Delete account',
    destructive: true,
    fields: [
      {
        key: 'deleteAccount', label: 'Delete my account and everything in it', kind: 'action',
        help: 'Removes every capture, link and comment. This cannot be undone.',
      },
    ],
  },
];
