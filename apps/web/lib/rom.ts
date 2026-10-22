import { Nes } from 'nes-simulator';
import { localePath, type Locale } from '@/lib/i18n';

export function readRomError(buffer: ArrayBuffer): string | null {
  const nes = new Nes();
  try {
    if (!nes.loadRom(buffer.slice(0))) {
      return 'UNRECOGNIZED_ROM';
    }
    return null;
  } catch (err) {
    return err instanceof Error && err.message ? err.message : 'LOAD_FAILED';
  } finally {
    nes.dispose();
  }
}

export function errorHref(locale: Locale, reason: string): string {
  return localePath(locale, `/error?reason=${encodeURIComponent(reason)}`);
}
