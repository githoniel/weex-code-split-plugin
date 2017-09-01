const assign = require('lodash/assign')
const ConcatSource = require("webpack-sources").ConcatSource

/**
 * validate plugin options
 * 
 * @param {any} options 
 */
function validateOptions(options) {
    if (!options || !options.fsReadFunction) {
        throw new Error(`weex-async-plugin option validate fail:
            fsReadFunction is required in type \`string\` or \`function\``)
    }
}

/**
 * init plugin instance
 * 
 * @param {any} options 
 */
function Instance(options) {
    validateOptions(options)
    if (typeof options.fsReadFunction === 'function') {
        options.fsReadFunction = options.fsReadFunction.toString()
    }
    this.options = assign({
        fsReadFunction: null,
        publicPath: null
    }, options || {})
}

Instance.prototype.apply = function apply(compiler) {
    const options = this.options
    compiler.plugin('compilation', function (compilation) {
        // inject fs read function
        compilation.mainTemplate.plugin("local-vars", function (source, chunk) {
            if (chunk.chunks.length > 0) {
                return this.asString([
                    source,
                    "",
                    "// objects to store loaded and loading chunks",
                    "var installedChunks = {",
                    this.indent(
                        chunk.ids.map(id => `${JSON.stringify(id)}: 0`).join(",\n")
                    ),
                    "};",
                    "var weexFsRead = " + options.fsReadFunction + ";",
                    ""
                ]);
            }
            return source;
        })
        // add weex weexJsonpContext
        compilation.mainTemplate.plugin("bootstrap", function (source, chunk, hash) {
            if (chunk.chunks.length > 0) {
                var jsonpFunction = this.outputOptions.jsonpFunction;
                return this.asString([
                    "",
                    "// install a JSONP callback for chunk loading",
                    "var isWeex = typeof weex !== 'undefined' && weex.config.env.platform !== 'Web'",
                    "var weexJsonpContext = {};",
                    "var context = isWeex ? weexJsonpContext : window;",
                    `var parentJsonpFunction = context[${JSON.stringify(jsonpFunction)}];`,
                    `context[${JSON.stringify(jsonpFunction)}] = function webpackJsonpCallback(chunkIds, moreModules, executeModules) {`,
                    this.indent([
                        "// add \"moreModules\" to the modules object,",
                        "// then flag all \"chunkIds\" as loaded and fire callback",
                        "var moduleId, chunkId, i = 0, resolves = [], result;",
                        "for(;i < chunkIds.length; i++) {",
                        this.indent([
                            "chunkId = chunkIds[i];",
                            "if(installedChunks[chunkId]) {",
                            this.indent("resolves.push(installedChunks[chunkId][0]);"),
                            "}",
                            "installedChunks[chunkId] = 0;"
                        ]),
                        "}",
                        "for(moduleId in moreModules) {",
                        this.indent([
                            "if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {",
                            this.indent(this.renderAddModule(hash, chunk, "moduleId", "moreModules[moduleId]")),
                            "}"
                        ]),
                        "}",
                        "if(parentJsonpFunction) parentJsonpFunction(chunkIds, moreModules, executeModules);",
                        "while(resolves.length) {",
                        this.indent("resolves.shift()();"),
                        "}",
                        this.entryPointInChildren(chunk) ? [
                            "if(executeModules) {",
                            this.indent([
                                "for(i=0; i < executeModules.length; i++) {",
                                this.indent(`result = ${this.requireFn}(${this.requireFn}.s = executeModules[i]);`),
                                "}"
                            ]),
                            "}",
                            "return result;",
                        ] : ""
                    ]),
                    "};"
                ]);
            }
            return source;
        })
        // move header && header.append to jsonp-script
        compilation.mainTemplate.plugin("require-ensure", function (_, chunk, hash) {
            return this.asString([
                "var installedChunkData = installedChunks[chunkId];",
                "if(installedChunkData === 0) {",
                this.indent([
                    "return new Promise(function(resolve) { resolve(); });"
                ]),
                "}",
                "",
                "// a Promise means \"currently loading\".",
                "if(installedChunkData) {",
                this.indent([
                    "return installedChunkData[2];"
                ]),
                "}",
                "",
                "// setup Promise in chunk cache",
                "var promise = new Promise(function(resolve, reject) {",
                this.indent([
                    "installedChunkData = installedChunks[chunkId] = [resolve, reject];"
                ]),
                "});",
                "installedChunkData[2] = promise;",
                "",
                "// start chunk loading",
                this.applyPluginsWaterfall("jsonp-script", "", chunk, hash),
                "return promise;"
            ]);
        })

        compilation.mainTemplate.plugin('jsonp-script', function (_, chunk, hash) {
            const chunkFilename = this.outputOptions.chunkFilename;
            const chunkMaps = chunk.getChunkMaps();
            const crossOriginLoading = this.outputOptions.crossOriginLoading;
            const chunkLoadTimeout = this.outputOptions.chunkLoadTimeout;
            const scriptSrcPath = this.applyPluginsWaterfall("asset-path", JSON.stringify(chunkFilename), {
                hash: `" + ${this.renderCurrentHashCode(hash)} + "`,
                hashWithLength: length => `" + ${this.renderCurrentHashCode(hash, length)} + "`,
                chunk: {
                    id: "\" + chunkId + \"",
                    hash: `" + ${JSON.stringify(chunkMaps.hash)}[chunkId] + "`,
                    hashWithLength(length) {
                        const shortChunkHashMap = Object.create(null);
                        Object.keys(chunkMaps.hash).forEach(chunkId => {
                            if (typeof chunkMaps.hash[chunkId] === "string")
                                shortChunkHashMap[chunkId] = chunkMaps.hash[chunkId].substr(0, length);
                        });
                        return `" + ${JSON.stringify(shortChunkHashMap)}[chunkId] + "`;
                    },
                    name: `" + (${JSON.stringify(chunkMaps.name)}[chunkId]||chunkId) + "`
                }
            });
            const weexBasePath = options.publicPath ? `"${options.publicPath}"` : `${this.requireFn}.p`
            return this.asString([
                "if (isWeex) {",
                this.indent([
                    `weexFsRead(${weexBasePath} + ${scriptSrcPath})`,
                    this.indent([
                        `.then(function(jsContent){`,
                        `new Function(jsContent).call(context);`,
                        "var chunk = installedChunks[chunkId];",
                        "if(chunk !== 0) {",
                        this.indent([
                            "if(chunk) {",
                            this.indent("chunk[1](new Error('Loading chunk ' + chunkId + ' failed.'));"),
                            "}",
                            "installedChunks[chunkId] = undefined;"
                        ]),
                        `}`
                    ]),
                    "})"
                ]),
                "} else {",
                this.indent([
                    "var head = document.getElementsByTagName('head')[0];",
                    "var script = document.createElement('script');",
                    "script.type = 'text/javascript';",
                    "script.charset = 'utf-8';",
                    "script.async = true;",
                    `script.timeout = ${chunkLoadTimeout};`,
                    crossOriginLoading ? `script.crossOrigin = ${JSON.stringify(crossOriginLoading)};` : "",
                    `if (${this.requireFn}.nc) {`,
                    this.indent(`script.setAttribute("nonce", ${this.requireFn}.nc);`),
                    "}",
                    `script.src = ${this.requireFn}.p + ${scriptSrcPath};`,
                    `var timeout = setTimeout(onScriptComplete, ${chunkLoadTimeout});`,
                    "script.onerror = script.onload = onScriptComplete;",
                    "function onScriptComplete() {",
                    this.indent([
                        "// avoid mem leaks in IE.",
                        "script.onerror = script.onload = null;",
                        "clearTimeout(timeout);",
                        "var chunk = installedChunks[chunkId];",
                        "if(chunk !== 0) {",
                        this.indent([
                            "if(chunk) {",
                            this.indent("chunk[1](new Error('Loading chunk ' + chunkId + ' failed.'));"),
                            "}",
                            "installedChunks[chunkId] = undefined;"
                        ]),
                        "}"
                    ]),
                    "};",
                    "head.appendChild(script);",
                    "",
                ]),
                "}"
            ]);
        })

        compilation.chunkTemplate.plugin("render", function(modules, chunk) {
			const jsonpFunction = this.outputOptions.jsonpFunction;
			const source = new ConcatSource();
			source.add(`this.${jsonpFunction}(${JSON.stringify(chunk.ids)},`);
			source.add(modules);
			const entries = [chunk.entryModule].filter(Boolean).map(m => m.id);
			if(entries.length > 0) {
				source.add(`,${JSON.stringify(entries)}`);
			}
			source.add(")");
			return source;
		});
    })
}

module.exports = Instance