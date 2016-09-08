/*global require*/
var rollup = require('rollup').rollup;
var typescript = require('rollup-plugin-typescript');
var tsOptions = {
  "target": "es6",
  "module": "es6",
  "removeComments": true
};

var configs = [
  { entry: 'src/main.ts',
    dest: 'www/main.js',
    format: 'iife',
    plugins: [typescript(tsOptions)],
    sourceMap: true },
  { entry: 'src/upload-worker.ts',
    dest: 'www/upload-worker.js',
    format: 'iife',
    plugins: [typescript(tsOptions)],
    sourceMap: true },
  { entry: 'src/download-worker.ts',
    dest: 'www/download-worker.js',
    format: 'iife',
    plugins: [typescript(tsOptions)],
    sourceMap: true },
  { entry: 'src/github-worker.ts',
    dest: 'www/github-worker.js',
    format: 'iife',
    plugins: [typescript(tsOptions)],
    sourceMap: true },
  { entry: 'src/server.ts',
    dest: 'server.js',
    format: 'cjs',
    plugins: [typescript(tsOptions)],
    globals: ["net","https","url","fs"],
    sourceMap: false },
  // { entry: 'CodeMirror/lib/codemirror.js',
  //   dest: 'www/codemirror.js',
  //   format: 'iife',
  //   sourceMap: true }
];

configs.forEach(config => {
  rollup(config).then(bundle => {
    return bundle.write(config)
  }).catch(console.error);
});
