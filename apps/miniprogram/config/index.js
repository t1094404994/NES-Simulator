const path = require('node:path');

const libraryEntry = path.resolve(__dirname, '../../../core/nes/src/index.ts');
const libraryRoot = path.resolve(__dirname, '../../../core/nes/src');
const sharedEntry = path.resolve(__dirname, '../../../packages/shared/src/index.ts');
const sharedRoot = path.resolve(__dirname, '../../../packages/shared/src');

const config = {
  projectName: 'nes-miniprogram',
  date: '2026-10-12',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {
    API_BASE: JSON.stringify(process.env.API_BASE || 'http://127.0.0.1:8787'),
  },
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false,
  },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false, config: {} },
    },
    webpackChain(chain) {
      chain.resolve.alias.set('nes-simulator', libraryEntry);
      chain.resolve.alias.set('@nes/shared', sharedEntry);
      chain.module
        .rule('nes-library')
        .test(/\.tsx?$/)
        .include.add(libraryRoot)
        .add(sharedRoot)
        .end()
        .use('babel')
        .loader('babel-loader')
        .options({
          presets: [[
            'babel-preset-taro',
            { framework: 'react', ts: true, compiler: 'webpack5' },
          ]],
        });
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: { enable: false, config: {} },
    },
  },
};

module.exports = function mergeConfig(merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
};
