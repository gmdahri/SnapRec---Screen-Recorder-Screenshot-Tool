import type { IconifyIcon } from '@iconify/types';
import { icons as antd } from '@iconify-json/ant-design';

/** Pull one icon out of the bundled ant-design set at module load. */
function pick(name: string): IconifyIcon {
  const raw = antd.icons[name];
  if (!raw) throw new Error(`ant-design icon "${name}" does not exist`);
  return {
    body: raw.body,
    width: raw.width ?? antd.width ?? 1024,
    height: raw.height ?? antd.height ?? 1024,
  };
}

export const icons = Object.freeze({
  record: pick('video-camera-outlined'),
  screenshot: pick('camera-outlined'),
  settings: pick('setting-outlined'),
  chrome: pick('chrome-outlined'),
  desktop: pick('desktop-outlined'),
  expand: pick('expand-outlined'),
  audio: pick('audio-outlined'),
  audioMuted: pick('audio-muted-outlined'),
  sound: pick('sound-outlined'),
  user: pick('user-outlined'),
  eyeInvisible: pick('eye-invisible-outlined'),
  pause: pick('pause-outlined'),
  play: pick('caret-right-outlined'),
  reload: pick('reload-outlined'),
  highlight: pick('highlight-outlined'),
  holder: pick('holder-outlined'),
  copy: pick('copy-outlined'),
  download: pick('download-outlined'),
  scissor: pick('scissor-outlined'),
  cloudUpload: pick('cloud-upload-outlined'),
  delete: pick('delete-outlined'),
  close: pick('close-outlined'),
  check: pick('check-outlined'),
  link: pick('link-outlined'),
  like: pick('like-outlined'),
  fileText: pick('file-text-outlined'),
  fullscreen: pick('fullscreen-outlined'),
  arrowLeft: pick('arrow-left-outlined'),
  right: pick('right-outlined'),
  down: pick('down-outlined'),
  borderless: pick('borderless-table-outlined'),
  borderOuter: pick('border-outer-outlined'),
  verticalAlignBottom: pick('vertical-align-bottom-outlined'),
  playCircle: pick('play-circle-outlined'),
});

export type IconName = keyof typeof icons;
