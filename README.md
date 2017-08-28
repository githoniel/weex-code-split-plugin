# weex-async-plugin

restore webpack code-splite feature for weex, this plugin need you to give a fs read function and it will use 
`new Function` to run your splited code.

## Install

download this project, copy index.js to your project.

## Usage

add below to you webpack.config.js
```js
const WeexAsyncPlugin = require('../index')

module.exports = {
    plugins: [
        new WeexAsyncPlugin({
            fsReadFunction:weexFSRead,
            publicPath: './'
        })
  ]
}
```

## Options

*fsReadFunction(required, string/function)*: fs read function, do not use any es6 syntax for compatibility.

*publicPath(optional, string)*: override webpack's public path for weexFSRead's base path.