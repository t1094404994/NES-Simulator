const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: {
    app: './src/index.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Production',
    }),
  ],
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(tsx|ts)$/i,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    //   {
    //     test: /\.(png|svg|jpg|jpeg|gif)$/i,
    //     type: 'asset/resource',
    //   },
    //   {
    //     test: /\.(woff|woff2|eot|ttf|otf)$/i,
    //     type: 'asset/resource',
    //   },
    ],
  },
  resolve: {
    //允许的导入文件类型
    extensions: ['.ts', '.tsx', '.js']
  },
}