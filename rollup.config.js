import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';
import userscriptMeta from 'rollup-plugin-userscript-metablock';
import PACKAGE from './package.json';

const { PRODUCTION } = process.env;

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

export default [ 'content', 'ui' ].map(source => ({
  input: `src/${source}.js`,
  output: {
    file: `dist/src/${source}.js`,
    format: 'iife',
  },
  treeshake: true,
  plugins,
})).concat({
  input: `src/ui.js`,
  output: {
    file: `userscript/DuolingoWordBankDnd.user.js`,
    format: 'iife',
  },
  treeshake: true,
  plugins: [
    ...plugins,
    userscriptMeta({
      file: './userscript/meta.json',
      override: {
        version: PACKAGE.version,
        homepage: PACKAGE.homepage,
        author: PACKAGE.author,
        license: PACKAGE.license,
      },
    }),
  ],
});
