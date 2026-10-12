import { NesGpuScreen } from './gpuScreen';
import { NesGlScreen } from './glScreen';
import { NesScreen, type NesPresenter } from './screen';

export type NesRendererKind = 'webgpu' | 'webgl' | '2d';

/** 当前环境能用的渲染器，按 WebGPU、WebGL、Canvas 2D 排列。 */
export function detectRenderers(): NesRendererKind[] {
  const kinds: NesRendererKind[] = [];
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
    kinds.push('webgpu');
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2') || document.createElement('canvas').getContext('webgl')) {
      kinds.push('webgl');
    }
  }
  kinds.push('2d');
  return kinds;
}

export async function openPresenter(canvas: HTMLCanvasElement, kind: NesRendererKind): Promise<NesPresenter> {
  if (kind === 'webgpu') {
    return NesGpuScreen.open(canvas);
  }
  if (kind === 'webgl') {
    return new NesGlScreen(canvas);
  }
  return new NesScreen(canvas);
}
