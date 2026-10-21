import Taro from '@tarojs/taro';
import { romSaveKey } from 'nes-simulator';

export function batteryStorageKey(rom: ArrayBuffer): string {
  return `nes-battery:${romSaveKey(rom)}`;
}

export async function readBattery(key: string): Promise<Uint8Array | null> {
  try {
    const stored = await Taro.getStorage({ key });
    const data = stored.data as unknown;
    if (!Array.isArray(data)) {
      return null;
    }
    return Uint8Array.from(data);
  } catch {
    return null;
  }
}

export async function writeBattery(key: string, bytes: Uint8Array): Promise<void> {
  await Taro.setStorage({ key, data: Array.from(bytes) });
}

export async function deleteBattery(key: string): Promise<void> {
  try {
    await Taro.removeStorage({ key });
  } catch {
    // 没有这份存档
  }
}
