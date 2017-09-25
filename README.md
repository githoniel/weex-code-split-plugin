# weex-async-plugin

restore webpack code-splite feature for weex, this plugin need you to give a fs read function and it will use 
`new Function` to run your splited code.

## Install

```bash
npm install weex-async-plugins --save
```

## Usage

add below to you webpack.config.js
```js
const WeexCodeSplitPlugin = require('weex-code-split-plugin')

module.exports = {
    plugins: [
        new WeexCodeSplitPlugin({
            fsReadFunction:weexFSRead,
            publicPath: '/Share/ULightApp'
        })
  ]
}
```

## Options

`fsReadFunction(required, string/function)`: fs read function, do not use any es6 syntax for compatibility.

`publicPath(optional, string)`: override webpack's public path for weexFSRead's base path.

## DEV mode

if you wants to use this in dev mode running at real device.
you need to rewrite the publicPath as below
```js
const ip = require('ip').address()
const port = require('../port') // you port

weexConfig.plugins.forEach((item) => {
    if (item instanceof WeexCodeSplitPlugin) {
        item.options.publicPath = `http://${ip}:${port}/`
    }
})
```