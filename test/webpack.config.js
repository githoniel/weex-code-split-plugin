const HtmlWebpackPlugin = require('html-webpack-plugin')
const WeexAsyncPlugin = require('../index')

/* global weex:false */
function weexFSRead(path) {
  return new Promise(function (resolve, reject) {
    const commModule = weex.requireModule('CommPlugin')
    commModule.exec(function (data) {
      resolve(data)
    }, function (e) {
      reject(new Error(e))
    }, 'CommPlugin', 'getByteArrayFromSD', [path])
  })
}

module.exports = {
  // devtool:'source-map',
  entry: {
    app: __dirname + "/app/index.js", //已多次提及的唯一入口文件
  },
  output: {
    path: __dirname + "/public", //打包后的文件存放的地方
    filename: "bundle-[name].js" //打包后输出文件的文件名
  },
  devServer: {
    contentBase: "./public", //本地服务器所加载的页面所在的目录
    colors: true, //终端中输出结果为彩色
    historyApiFallback: true, //不跳转
    inline: true //实时刷新
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: __dirname + "/app/index.html" //new 一个这个插件的实例，并传入相关的参数
    }),
    new WeexAsyncPlugin({
      fsReadFunction:weexFSRead,
      // publicPath: '/test'
    })
  ]
}