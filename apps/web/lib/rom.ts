import { Nes } from 'nes-simulator';

export function readRomError(buffer: ArrayBuffer): string | null {
  const nes = new Nes();
  try {
    if (!nes.loadRom(buffer.slice(0))) {
      return '无法识别的 ROM';
    }
    return null;
  } catch (err) {
    return err instanceof Error && err.message ? err.message : '加载失败';
  } finally {
    nes.dispose();
  }
}

export function errorHref(reason: string): string {
  return `/error?reason=${encodeURIComponent(reason)}`;
}
