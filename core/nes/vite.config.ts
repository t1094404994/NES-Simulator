import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dts from 'vite-plugin-dts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: resolve(rootDir, 'playground'),
      resolve: {
        alias: {
          'nes-simulator': resolve(rootDir, 'src/index.ts'),
        },
      },
      server: {
        host: true,
      },
    };
  }

  return {
    plugins: [
      dts({
        include: ['src'],
        exclude: ['playground'],
        rollupTypes: true,
        insertTypesEntry: true,
        tsconfigPath: resolve(rootDir, 'tsconfig.build.json'),
      }),
    ],
    build: {
      lib: {
        entry: resolve(rootDir, 'src/index.ts'),
        name: 'NESSimulator',
        formats: ['es', 'umd'],
        fileName: (format) =>
          format === 'es' ? 'nes-simulator.js' : 'nes-simulator.umd.cjs',
      },
      sourcemap: true,
      emptyOutDir: true,
    },
  };
});
