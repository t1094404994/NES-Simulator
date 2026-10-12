import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const libraryEntry = path.resolve(rootDir, '../../core/nes/src/index.ts');
const sharedEntry = path.resolve(rootDir, '../../packages/shared/src/index.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['nes-simulator', '@nes/shared'],
  webpack: (config) => {
    config.resolve.alias['nes-simulator'] = libraryEntry;
    config.resolve.alias['@nes/shared'] = sharedEntry;
    return config;
  },
  turbopack: {
    resolveAlias: {
      'nes-simulator': libraryEntry,
      '@nes/shared': sharedEntry,
    },
  },
};

export default nextConfig;
