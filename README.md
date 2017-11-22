# **karma-rollup-preprocessor**

Karma preprocessor to compile js files with [rollup](https://github.com/rollup/rollup).

> Support source maps (Karma reporter will log original file, line and column) and embed a file watcher to recompile and run the tests when a dependency is modified.

[![Travis](https://img.shields.io/travis/vanduynslagerp/karma-rollup-preprocessor.svg)](https://travis-ci.org/vanduynslagerp/karma-rollup-preprocessor)
[![AppVeyor](https://img.shields.io/appveyor/ci/vanduynslagerp/karma-rollup-preprocessor.svg)](https://ci.appveyor.com/project/vanduynslagerp/karma-rollup-preprocessor)
[![Codecov](https://img.shields.io/codecov/c/github/vanduynslagerp/karma-rollup-preprocessor.svg)](https://codecov.io/gh/vanduynslagerp/karma-rollup-preprocessor)
[![Greenkeeper badge](https://badges.greenkeeper.io/vanduynslagerp/karma-rollup-preprocessor.svg)](https://greenkeeper.io/)
[![license](https://img.shields.io/github/license/vanduynslagerp/karma-rollup-preprocessor.svg)](https://github.com/vanduynslagerp/karma-rollup-preprocessor/blob/master/LICENSE)

## Installation

```bash
npm install rollup @metahub/karma-rollup-preprocessor --save-dev
```

## Configuration

All the [rollup](https://rollupjs.org/#big-list-of-options) options can be passed to `rollupPreprocessor.options`.

In addition the preprocessor accept a `transformPath` function, to rewrite the path on which the files are deployed on the Karma webserver. If not specified, the processed files will be accessible with the same paths as the originals. For example `test/unit.test.js` will be deployed as `base/test/unit.test.js`.

### Standard

```js
const babel = require('rollup-plugin-babel');

module.exports = function(config) {
  config.set({
    files: ['test/main.test.js', 'src/js/main.js'],

    plugins: ['@metahub/karma-rollup-preprocessor', 'karma-*'],
    preprocessors: {'**/*.js': ['rollup']},

    rollupPreprocessor: {
      options: {
        output: {
          // To include inlined sourcemaps as data URIs
          sourcemap: true,
          format: 'iife'
        },
        // To compile with babel using es2015 preset
        plugins: [babel({presets: [['es2015', {modules: false}]]})]
      },
      // File src/js/main.js will be deployed on Karma with path base/script/main.js
      transformPath: filePath => filePath.replace('src/js', 'script')
    },
  });
};
```
**_Note: Karma can auto-load plugins named `karma-*` (see [plugins](http://karma-runner.github.io/1.0/config/plugins.html)). Unfortunatly it doesn't work with [scoped packages](https://docs.npmjs.com/misc/scope), therefore `@metahub/karma-rollup-preprocessor` has to be explicitly added to the `plugins` configuration. In order to continue to automatically load other plugins you can add `karma-*` to the `plugins` configuration._**

**_Note: `@metahub/karma-rollup-preprocessor` embed its own watcher to monitor js module dependencies, therefore only the main entry point has to be configured in Karma. If Karma is configured with `autoWatch: true`, the modification of an imported js module will trigger a new build and test run._**

### Configured Preprocessors
See [configured preprocessors](http://karma-runner.github.io/1.0/config/preprocessors.html).

```js
module.exports = function(config) {
  config.set({
    files: ['test/main.test.js', 'src/js/main.js'],

    plugins: ['@metahub/karma-rollup-preprocessor', 'karma-*'],
    preprocessors: {'src/**/*.js': ['rollup_1'], 'test/**/*.js': ['rollup_2']},

    customPreprocessors: {
      rollup_1: {
        base: 'rollup',
        options: {
          output: {
            sourcemap: false,
            format: 'iife'
          },
          plugins: [babel({presets: [['es2015', {modules: false}]]})]
        },
      },
      rollup_2: {
        base: 'rollup',
        options: {
          output: {
            sourcemap: true,
            format: 'iife'
          }
          plugins: [babel({presets: [['es2015', {modules: false}]]})]
        },
      },
    },
  });
};
```

## Bundling tests

All tests files and their dependencies (and potentially sources) can easily be bundled in one package.

```bash
npm install rollup @metahub/karma-rollup-preprocessor rollup-plugin-babel babel-preset-es2015 rollup-plugin-glob-import  --save-dev
```
```
.
├── test
|   ├── main.js
|   ├── unit-test-1.test.js // imported by test/main.js
|   ├── unit-test-2.test.js // imported by test/main.js
|   ├── unit-test-3.test.js // imported by test/main.js
|   ├── helpers
|       └── utils.js // imported by unit-test-1.test.js, unit-test-2.test.js and unit-test-3.test.js
├── src
|   ├── main.js
|   ├── dependency.js // imported by src/main.js
```
```javascript
// test/main.js

import './*.test.js'; // using https://github.com/kei-ito/rollup-plugin-glob-import

```
```javascript
// test/unit-test-1.test.js

import {myUtil} from './helpers/utils.js';

describe('My unit tests', () => {
  it('shoud works', () => {
    ...
  });
});
```
```javascript
// test/unit-test-2.test.js

import {myOtherUtil} from './helpers/utils.js';

describe('My other unit tests', () => {
  it('shoud also works', () => {
    ...
  });
});
```
```js
const babel = require('rollup-plugin-babel');
const globImport = require('rollup-plugin-glob-import');

module.exports = function(config) {
  config.set({
    files: ['test/main.js', 'src/main.js'],

    plugins: ['@metahub/karma-rollup-preprocessor', 'karma-*'],
    preprocessors: {'**/*.js': ['rollup']},

    rollupPreprocessor: {
      options: {
        output: {
          sourcemap: true,
          format: 'iife'
        },
        plugins: [globImport(), babel({presets: [['es2015', {modules: false}]]})]
      },
    },
  });
};
```
