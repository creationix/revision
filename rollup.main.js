import typescript from 'rollup-plugin-typescript'

export default {
  entry: 'src/main.ts',
  dest: 'www/main.js',
  format: 'iife',
  plugins: [
    typescript({
      "target": "es6",
      "module": "es6",
      "removeComments": true
    })
  ],
  sourceMap: true
}
