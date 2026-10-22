export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

export type Messages = {
  siteDescription: string;
  homeTitle: string;
  keywords: string[];
  gameList: string;
  gameListName: string;
  pickLocalRom: string;
  gameListFailed: (apiBase: string) => string;
  noGames: string;
  playDescription: (title: string) => string;
  playGeneric: string;
  gameNotFoundTitle: string;
  gameNotFoundDescription: string;
  gameFallbackTitle: string;
  localRom: string;
  localRomDescription: string;
  back: string;
  fileStaysLocal: string;
  pickNesFile: string;
  readFileFailed: string;
  pageNotFoundTitle: string;
  pageNotFoundDescription: string;
  backHome: string;
  loadFailedTitle: string;
  loadFailedDescription: string;
  cannotStart: string;
  loadFailed: string;
  serverUnreachable: string;
  gameMissing: string;
  romDownloadFailed: string;
  unrecognizedRom: string;
  backAria: string;
  settingsAria: string;
  keyboardHelp: string;
  start: string;
  resume: string;
  pause: string;
  debugOn: string;
  debugOff: string;
  clearSave: string;
  speed: string;
  pixels: string;
  fit: string;
  renderer: string;
  aspect: string;
  native: string;
  fps: (present: number, sim: number) => string;
  closeAria: string;
  padUp: string;
  padDown: string;
  padLeft: string;
  padRight: string;
  loading: string;
  chinese: string;
  english: string;
};

const zh: Messages = {
  siteDescription: '免费在线 NES / FC 红白机模拟器。在浏览器里打开游戏库直接游玩，也可以选择本地 ROM，无需安装。',
  homeTitle: 'NES Simulator：在线红白机模拟器',
  keywords: ['NES', 'FC', '红白机', '模拟器', '在线游戏'],
  gameList: '游戏列表',
  gameListName: 'NES Simulator 游戏列表',
  pickLocalRom: '选择本地 ROM',
  gameListFailed: (apiBase) => `游戏列表加载失败。请先启动后台（默认 ${apiBase}）。`,
  noGames: '还没有游戏。可以直接选择本地 ROM。',
  playDescription: (title) => `在浏览器中游玩 ${title}，打开即玩，无需安装。`,
  playGeneric: '在浏览器中游玩这款 NES 游戏，打开即玩，无需安装。',
  gameNotFoundTitle: '找不到游戏',
  gameNotFoundDescription: '这个地址没有对应的 NES 游戏。',
  gameFallbackTitle: '游戏',
  localRom: '本地 ROM',
  localRomDescription: '选择本机 .nes 文件，在浏览器里直接游玩。文件不会上传。',
  back: '返回',
  fileStaysLocal: '文件只在浏览器里运行，不会上传。',
  pickNesFile: '选择 .nes 文件',
  readFileFailed: '读取文件失败',
  pageNotFoundTitle: '页面不存在',
  pageNotFoundDescription: '这个地址没有对应的页面。',
  backHome: '返回首页',
  loadFailedTitle: '加载失败',
  loadFailedDescription: '这款 NES 游戏暂时无法在浏览器中运行。',
  cannotStart: '无法开始游戏',
  loadFailed: '加载失败',
  serverUnreachable: '无法连接服务器',
  gameMissing: '找不到这款游戏',
  romDownloadFailed: 'ROM 下载失败',
  unrecognizedRom: '无法识别的 ROM',
  backAria: '返回',
  settingsAria: '设置',
  keyboardHelp: '键盘：J / L 为 A / B，W A S D 方向，Q / E 为 Select / Start',
  start: '开始',
  resume: '继续',
  pause: '暂停',
  debugOn: '调试：开',
  debugOff: '调试：关',
  clearSave: '清除存档',
  speed: '倍速',
  pixels: '像素',
  fit: '适应',
  renderer: '渲染',
  aspect: '画面',
  native: '原始',
  fps: (present, sim) => `画面 ${present} · 模拟 ${sim}`,
  closeAria: '关闭',
  padUp: '上',
  padDown: '下',
  padLeft: '左',
  padRight: '右',
  loading: '加载中',
  chinese: '中文',
  english: 'EN',
};

const en: Messages = {
  siteDescription: 'Free online NES / Famicom emulator. Play the game library in your browser, or open a local ROM. No install.',
  homeTitle: 'NES Simulator: Online NES Emulator',
  keywords: ['NES', 'Famicom', 'emulator', 'online', 'ROM'],
  gameList: 'Games',
  gameListName: 'NES Simulator games',
  pickLocalRom: 'Open local ROM',
  gameListFailed: (apiBase) => `Couldn't load the game list. Start the server (default ${apiBase}).`,
  noGames: 'No games yet. You can open a local ROM.',
  playDescription: (title) => `Play ${title} in the browser. No install.`,
  playGeneric: 'Play this NES game in the browser. No install.',
  gameNotFoundTitle: 'Game not found',
  gameNotFoundDescription: 'This address does not match an NES game.',
  gameFallbackTitle: 'Game',
  localRom: 'Local ROM',
  localRomDescription: 'Choose a .nes file on this device and play it in the browser. The file is not uploaded.',
  back: 'Back',
  fileStaysLocal: 'The file stays in your browser and is not uploaded.',
  pickNesFile: 'Choose a .nes file',
  readFileFailed: 'Could not read the file',
  pageNotFoundTitle: 'Page not found',
  pageNotFoundDescription: 'This address does not match a page.',
  backHome: 'Back to home',
  loadFailedTitle: 'Could not load',
  loadFailedDescription: 'This NES game cannot run in the browser right now.',
  cannotStart: 'Cannot start the game',
  loadFailed: 'Could not load',
  serverUnreachable: 'Cannot reach the server',
  gameMissing: 'This game was not found',
  romDownloadFailed: 'Could not download the ROM',
  unrecognizedRom: 'Unrecognized ROM',
  backAria: 'Back',
  settingsAria: 'Settings',
  keyboardHelp: 'Keyboard: J / L are A / B, W A S D move, Q / E are Select / Start',
  start: 'Start',
  resume: 'Resume',
  pause: 'Pause',
  debugOn: 'Debug: on',
  debugOff: 'Debug: off',
  clearSave: 'Clear save',
  speed: 'Speed',
  pixels: 'Pixels',
  fit: 'Fit',
  renderer: 'Renderer',
  aspect: 'Picture',
  native: 'Native',
  fps: (present, sim) => `Video ${present} · Sim ${sim}`,
  closeAria: 'Close',
  padUp: 'Up',
  padDown: 'Down',
  padLeft: 'Left',
  padRight: 'Right',
  loading: 'Loading',
  chinese: '中文',
  english: 'EN',
};

const catalogs: Record<Locale, Messages> = { zh, en };

const errorKey = {
  UNRECOGNIZED_ROM: 'unrecognizedRom',
  LOAD_FAILED: 'loadFailed',
  GAME_NOT_FOUND: 'gameMissing',
  ROM_DOWNLOAD_FAILED: 'romDownloadFailed',
  SERVER_UNREACHABLE: 'serverUnreachable',
  READ_FILE_FAILED: 'readFileFailed',
} as const;

export function isLocale(value: string): value is Locale {
  return value === 'zh' || value === 'en';
}

export function resolveLocale(value: string | undefined): Locale {
  return value === 'en' ? 'en' : defaultLocale;
}

export function messagesFor(locale: Locale): Messages {
  return catalogs[locale];
}

export function htmlLang(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

export function ogLocale(locale: Locale): string {
  return locale === 'zh' ? 'zh_CN' : 'en_US';
}

export function localePath(locale: Locale, path: string): string {
  const queryIndex = path.indexOf('?');
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : path.slice(queryIndex);
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (locale === 'zh') {
    return `${normalized}${query}`;
  }
  if (normalized === '/') {
    return `/en${query}`;
  }
  return `/en${normalized}${query}`;
}

export function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) {
      return '/';
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname || '/';
}

export function translateError(code: string, messages: Messages): string {
  const key = errorKey[code as keyof typeof errorKey];
  if (!key) {
    return code;
  }
  return messages[key];
}
