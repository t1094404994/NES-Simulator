import { NES_HEIGHT, NES_WIDTH, type NesFrame } from './nes';

export type NesAspect = 'native' | '4:3' | '16:9';
export type NesPixelScale = 1 | 2 | 3 | 4 | 'fit';

const ASPECT_RATIO: Record<NesAspect, number> = {
  native: NES_WIDTH / NES_HEIGHT,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
};

export function frameDestRect(
  stageW: number,
  stageH: number,
  pixelScale: NesPixelScale,
): { scale: number; dx: number; dy: number; destW: number; destH: number } {
  const fit = Math.floor(Math.min(stageW / NES_WIDTH, stageH / NES_HEIGHT));
  const scale = pixelScale === 'fit' ? Math.max(1, fit) : pixelScale;
  const destW = NES_WIDTH * scale;
  const destH = NES_HEIGHT * scale;
  return {
    scale,
    destW,
    destH,
    dx: Math.floor((stageW - destW) / 2),
    dy: Math.floor((stageH - destH) / 2),
  };
}

/**
 * 把 NES 帧画到浏览器 canvas 上。
 * 舞台按宽高比留黑边，画面按整数倍像素居中，并关闭平滑缩放。
 */
export class NesScreen {
  private aspect: NesAspect = '16:9';
  private pixelScale: NesPixelScale = 'fit';
  private stageWidth = 0;
  private stageHeight = 0;
  private source: HTMLCanvasElement;
  private sourceCtx: CanvasRenderingContext2D;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法取得 canvas 2d 上下文');
    }
    this.ctx = ctx;
    this.source = document.createElement('canvas');
    this.source.width = NES_WIDTH;
    this.source.height = NES_HEIGHT;
    const sourceCtx = this.source.getContext('2d');
    if (!sourceCtx) {
      throw new Error('无法取得离屏 canvas 2d 上下文');
    }
    this.sourceCtx = sourceCtx;
    this.imageData = this.sourceCtx.createImageData(NES_WIDTH, NES_HEIGHT);
  }

  getAspect(): NesAspect {
    return this.aspect;
  }

  setAspect(aspect: NesAspect): void {
    this.aspect = aspect;
  }

  getPixelScale(): NesPixelScale {
    return this.pixelScale;
  }

  setPixelScale(scale: NesPixelScale): void {
    this.pixelScale = scale;
  }

  /** 当前宽高比对应的舞台比例，供外壳设置容器。 */
  getStageRatio(): number {
    return ASPECT_RATIO[this.aspect];
  }

  /** 按 CSS 像素设置舞台大小。画布位图会乘上 devicePixelRatio。 */
  resize(cssWidth: number, cssHeight: number): void {
    const width = Math.max(1, Math.floor(cssWidth));
    const height = Math.max(1, Math.floor(cssHeight));
    this.stageWidth = width;
    this.stageHeight = height;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const bitmapW = Math.max(1, Math.floor(width * dpr));
    const bitmapH = Math.max(1, Math.floor(height * dpr));
    if (this.canvas.width !== bitmapW || this.canvas.height !== bitmapH) {
      this.canvas.width = bitmapW;
      this.canvas.height = bitmapH;
    }
  }

  draw(frame: NesFrame): void {
    this.imageData.data.set(frame.rgba);
    this.sourceCtx.putImageData(this.imageData, 0, 0);

    const bitmapW = this.canvas.width || NES_WIDTH;
    const bitmapH = this.canvas.height || NES_HEIGHT;
    const { dx, dy, destW, destH } = frameDestRect(bitmapW, bitmapH, this.pixelScale);

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, bitmapW, bitmapH);
    this.ctx.drawImage(this.source, dx, dy, destW, destH);
  }
}
