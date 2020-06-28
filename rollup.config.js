import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

const { PRODUCTION } = process.env;

const sources = [ 'content', 'ui' ];

const plugins = [
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  resolve({
    browser: true,
  }),
  replace({
    'process.env.NODE_ENV': JSON.stringify(PRODUCTION ? 'production' : 'development'),
  }),
  commonjs(),
];

if (PRODUCTION) {
  plugins.push(terser());
}

export default sources.map(source => ({
  input: `src/${source}.js`,
  output: {
    file: `dist/src/${source}.js`,
    format: 'iife',
  },
  treeshake: true,
  plugins,
}));
