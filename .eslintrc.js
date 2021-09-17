module.exports = {
  'env': {
    'browser': true,
    'es2021': true
  },
  'extends': [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module'
  },
  'plugins': [
    '@typescript-eslint'
  ],
  'rules': {
    'indent': [2,2],//使用2格缩进
    'eqeqeq': [2,'always'],//使用强判断
    'semi':[2,'always'],//行尾需要分号
    'quotes':[2,'single'] //使用单引号
  }
};
