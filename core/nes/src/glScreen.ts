import { NES_HEIGHT, NES_WIDTH, type NesFrame } from './nes';
import { frameDestRect, type NesAspect, type NesPixelScale, type NesPresenter } from './screen';

const ASPECT_RATIO: Record<NesAspect, number> = {
  native: NES_WIDTH / NES_HEIGHT,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
};

const VERTEX = `
attribute vec2 aPos;
uniform vec4 uDest;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  vec2 pix = uDest.xy + aPos * uDest.zw;
  vec2 clip = pix / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aPos;
}
`;

const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  gl_FragColor = texture2D(uTex, vUv);
}
`;

type GL = WebGL2RenderingContext | WebGLRenderingContext;

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('无法创建着色器');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || '着色器编译失败';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

/** 用 WebGL 纹理保存 256×240 画面，增量帧只更新脏瓦片。 */
export class NesGlScreen implements NesPresenter {
  private aspect: NesAspect = '16:9';
  private pixelScale: NesPixelScale = 'fit';
  private gl: GL;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private destLoc: WebGLUniformLocation;
  private resLoc: WebGLUniformLocation;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })
      || canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) {
      throw new Error('无法取得 WebGL 上下文');
    }
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!program) {
      throw new Error('无法创建 WebGL 程序');
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'WebGL 程序链接失败');
    }
    this.program = program;
    const dest = gl.getUniformLocation(program, 'uDest');
    const res = gl.getUniformLocation(program, 'uRes');
    if (!dest || !res) {
      throw new Error('WebGL uniform 缺失');
    }
    this.destLoc = dest;
    this.resLoc = res;

    const texture = gl.createTexture();
    const buffer = gl.createBuffer();
    if (!texture || !buffer) {
      throw new Error('无法创建 WebGL 资源');
    }
    this.texture = texture;
    this.buffer = buffer;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NES_WIDTH, NES_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(NES_WIDTH * NES_HEIGHT * 4));

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0, 1, 0, 0, 1,
      0, 1, 1, 0, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);
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
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (frame.keyframe) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NES_WIDTH, NES_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, frame.rgba);
    } else {
      for (const tile of frame.tiles) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          tile.x * 8,
          tile.y * 8,
          8,
          8,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          tile.rgba,
        );
      }
    }
    this.present();
  }

  dispose(): void {
    const lose = this.gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  }

  private present(): void {
    const gl = this.gl;
    const bitmapW = this.canvas.width || NES_WIDTH;
    const bitmapH = this.canvas.height || NES_HEIGHT;
    const { dx, dy, destW, destH } = frameDestRect(bitmapW, bitmapH, this.pixelScale);
    gl.viewport(0, 0, bitmapW, bitmapH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4f(this.destLoc, dx, dy, destW, destH);
    gl.uniform2f(this.resLoc, bitmapW, bitmapH);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
