import { NES_HEIGHT, NES_WIDTH, type NesFrame } from './nes';
import { frameDestRect, type NesAspect, type NesPixelScale, type NesPresenter } from './screen';

const ASPECT_RATIO: Record<NesAspect, number> = {
  native: NES_WIDTH / NES_HEIGHT,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
};

const TEXTURE_BINDING = 0x04;
const COPY_DST_TEXTURE = 0x02;
const BUFFER_UNIFORM = 0x40;
const BUFFER_COPY_DST = 0x08;
const STAGE_VERTEX = 0x1;
const STAGE_FRAGMENT = 0x2;

const SHADER = `
struct Uniforms {
  dest: vec4f,
  res: vec2f,
  pad: vec2f,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) index: u32) -> VsOut {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let p = corners[index];
  let pix = u.dest.xy + p * u.dest.zw;
  let clip = pix / u.res * 2.0 - 1.0;
  var out: VsOut;
  out.pos = vec4f(clip.x, -clip.y, 0.0, 1.0);
  out.uv = p;
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  return textureSample(tex, samp, in.uv);
}
`;

/** WebGPU 纹理。8×8 上传按 256 字节行对齐补齐。 */
export class NesGpuScreen implements NesPresenter {
  private aspect: NesAspect = '16:9';
  private pixelScale: NesPixelScale = 'fit';
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  private texture: GPUTexture | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private uniform: GPUBuffer | null = null;
  private uniformData = new Float32Array(8);
  private tilePad = new Uint8Array(256 * 8);
  private disposed = false;
  private ready: Promise<void>;

  private constructor(private canvas: HTMLCanvasElement) {
    this.ready = this.init();
  }

  static open(canvas: HTMLCanvasElement): Promise<NesGpuScreen> {
    const screen = new NesGpuScreen(canvas);
    return screen.ready.then(() => screen);
  }

  private async init(): Promise<void> {
    const gpu = navigator.gpu;
    if (!gpu) {
      throw new Error('当前浏览器没有 WebGPU');
    }
    const adapter = await gpu.requestAdapter();
    if (!adapter || this.disposed) {
      throw new Error('无法取得 WebGPU 适配器');
    }
    const device = await adapter.requestDevice();
    if (this.disposed) {
      device.destroy();
      return;
    }
    const context = this.canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      device.destroy();
      throw new Error('无法取得 WebGPU 上下文');
    }
    const format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const texture = device.createTexture({
      size: [NES_WIDTH, NES_HEIGHT],
      format: 'rgba8unorm',
      usage: TEXTURE_BINDING | COPY_DST_TEXTURE,
    });
    const sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    const uniform = device.createBuffer({
      size: 32,
      usage: BUFFER_UNIFORM | BUFFER_COPY_DST,
    });
    const module = device.createShaderModule({ code: SHADER });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: STAGE_VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: STAGE_FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: STAGE_FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs' },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: texture.createView() },
        { binding: 2, resource: sampler },
      ],
    });
    this.device = device;
    this.context = context;
    this.format = format;
    this.texture = texture;
    this.uniform = uniform;
    this.pipeline = pipeline;
    this.bindGroup = bindGroup;
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

  getStageRatio(): number {
    return ASPECT_RATIO[this.aspect];
  }

  resize(cssWidth: number, cssHeight: number): void {
    const width = Math.max(1, Math.floor(cssWidth));
    const height = Math.max(1, Math.floor(cssHeight));
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const bitmapW = Math.max(1, Math.floor(width * dpr));
    const bitmapH = Math.max(1, Math.floor(height * dpr));
    if (this.canvas.width !== bitmapW || this.canvas.height !== bitmapH) {
      this.canvas.width = bitmapW;
      this.canvas.height = bitmapH;
    }
  }

  draw(frame: NesFrame): void {
    const device = this.device;
    const texture = this.texture;
    if (!device || !texture) {
      return;
    }
    if (frame.keyframe) {
      device.queue.writeTexture(
        { texture },
        frame.rgba,
        { bytesPerRow: NES_WIDTH * 4, rowsPerImage: NES_HEIGHT },
        { width: NES_WIDTH, height: NES_HEIGHT },
      );
    } else {
      for (const tile of frame.tiles) {
        for (let row = 0; row < 8; row += 1) {
          this.tilePad.set(tile.rgba.subarray(row * 32, row * 32 + 32), row * 256);
        }
        device.queue.writeTexture(
          { texture, origin: { x: tile.x * 8, y: tile.y * 8 } },
          this.tilePad,
          { bytesPerRow: 256, rowsPerImage: 8 },
          { width: 8, height: 8 },
        );
      }
    }
    this.present();
  }

  dispose(): void {
    this.disposed = true;
    this.texture?.destroy();
    this.uniform?.destroy();
    this.device?.destroy();
    this.texture = null;
    this.uniform = null;
    this.device = null;
    this.context = null;
  }

  private present(): void {
    const device = this.device;
    const context = this.context;
    const pipeline = this.pipeline;
    const bindGroup = this.bindGroup;
    const uniform = this.uniform;
    if (!device || !context || !pipeline || !bindGroup || !uniform) {
      return;
    }
    const bitmapW = this.canvas.width || NES_WIDTH;
    const bitmapH = this.canvas.height || NES_HEIGHT;
    const { dx, dy, destW, destH } = frameDestRect(bitmapW, bitmapH, this.pixelScale);
    this.uniformData[0] = dx;
    this.uniformData[1] = dy;
    this.uniformData[2] = destW;
    this.uniformData[3] = destH;
    this.uniformData[4] = bitmapW;
    this.uniformData[5] = bitmapH;
    device.queue.writeBuffer(uniform, 0, this.uniformData);
    const view = context.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
}
