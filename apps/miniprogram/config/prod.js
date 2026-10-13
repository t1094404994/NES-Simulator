module.exports = {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {
    API_BASE: JSON.stringify(process.env.API_BASE || 'https://www.nes-simulator.com'),
  },
  mini: {},
  h5: {},
};
