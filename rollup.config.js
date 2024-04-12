import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy'
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

const { PRODUCTION } = process.env;

const MANIFEST_VERSIONS = [ 'mv2', 'mv3' ];

const plugins = [
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  resolve({
    browser: true,
  }),
  replace({
    preventAssignment: true,
    'process.env.NODE_ENV': JSON.stringify(PRODUCTION ? 'production' : 'development'),
  }),
  commonjs(),
  copy({
    targets: MANIFEST_VERSIONS.map(mv => ({
      src: 'dist/common/*',
      dest: `dist/${mv}`,
    }))
  }),
];

if (PRODUCTION) {
  plugins.push(terser());
}

export default [
  'background',
  'content',
  'observer',
  'popup',
  'ui',
].map(source => ({
  plugins,
  treeshake: true,
  input: `src/${source}.js`,
  output: MANIFEST_VERSIONS.map(mv => ({
    file: `dist/${mv}/src/${source}.js`,
    format: 'iife',
  })),
}));
