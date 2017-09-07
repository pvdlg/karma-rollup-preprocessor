import path from 'path';
import {readFile, copy, outputFile, remove} from 'fs-extra';
import test from 'ava';
import {spy, match} from 'sinon';
import tempy from 'tempy';
import babel from 'rollup-plugin-babel';
import {waitFor, compile} from './helpers/utils';
import {mockPreprocessor} from './helpers/mock';

test('Compile JS file', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug} = await mockPreprocessor({}, {rollupPreprocessor: {options}});
  const file = {originalPath: fixture};

  t.is(await preprocessor(await readFile(fixture), file), (await compile(fixture, options)).code);
  t.true(debug.firstCall.calledWith(match('Processing'), fixture));
  t.is(path.resolve(file.path), path.resolve('test/fixtures/basic.js'));
});

test('Compile JS file with sourcemap (options.sourcemap)', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {sourcemap: true, format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug} = await mockPreprocessor({}, {rollupPreprocessor: {options}});
  const file = {originalPath: fixture};
  const {code, map} = await compile(fixture, options);

  t.is(await preprocessor(await readFile(fixture), file), code);
  t.deepEqual(file.sourceMap, map);
  t.is(file.sourceMap.file, path.basename(fixture));
  t.truthy(file.sourceMap.mappings);
  t.true(debug.firstCall.calledWith(match('Processing'), fixture));
  t.is(path.resolve(file.path), path.resolve('test/fixtures/basic.js'));
});

test('Compile JS file with sourcemap (options.sourcemap) and custom preprocessor', async t => {
  const fixture = 'test/fixtures/basic.custom.js';
  const options = {
    output: {sourcemap: true, format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug} = await mockPreprocessor({options});
  const file = {originalPath: fixture};
  const {code, map} = await compile(fixture, options);

  t.is(await preprocessor(await readFile(fixture), file), code);
  t.deepEqual(file.sourceMap, map);
  t.is(file.sourceMap.file, path.basename(fixture));
  t.truthy(file.sourceMap.mappings);
  t.true(debug.firstCall.calledWith(match('Processing'), fixture));
  t.is(path.resolve(file.path), path.resolve('test/fixtures/basic.custom.js'));
});

test('Compile JS file with custom transformPath', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const transformPath = spy(filePath => filePath.replace(/\.(js)$/, '.jsx').replace('fixtures/', ''));
  const {preprocessor, debug} = await mockPreprocessor({}, {rollupPreprocessor: {options, transformPath}});
  const file = {originalPath: fixture};

  t.is(await preprocessor(await readFile(fixture), file), (await compile(fixture, options)).code);
  t.true(debug.firstCall.calledWith(match('Processing'), fixture));
  t.true(transformPath.calledOnce);
  t.is(path.resolve(file.path), path.resolve('test/basic.jsx'));
});

test('Compile JS file with custom transformPath and custom preprocessor', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const transformPath = spy(filePath => filePath.replace(/\.(js)$/, '.jsx').replace('fixtures/', ''));
  const {preprocessor, debug} = await mockPreprocessor({options, transformPath});
  const file = {originalPath: fixture};

  t.is(await preprocessor(await readFile(fixture), file), (await compile(fixture, options)).code);
  t.true(debug.firstCall.calledWith(match('Processing'), fixture));
  t.true(transformPath.calledOnce);
  t.is(path.resolve(file.path), path.resolve('test/basic.jsx'));
});

test('Log error on invalid JS file', async t => {
  const fixture = 'test/fixtures/error.js';
  const {preprocessor, debug, error} = await mockPreprocessor();
  const file = {originalPath: fixture};
  const err = await t.throws(preprocessor(await readFile(fixture), file), Error);

  t.true(debug.firstCall.calledWith(match('Processing'), fixture));
  t.true(err.message.includes('Could not resolve'));
  t.true(error.firstCall.calledWith(match.string, fixture, match('Could not resolve')));
});

test('Instanciate watcher only if autoWatch is true', async t => {
  let {FSWatcher} = await mockPreprocessor();

  t.true(FSWatcher.notCalled);
  ({FSWatcher} = await mockPreprocessor({}, {autoWatch: true}));
  t.true(FSWatcher.calledOnce);
});

test('Add dependency to watcher', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const module = path.resolve('test/fixtures/modules/module.js');
  const subModule = path.resolve('test/fixtures/modules/sub-module.js');
  const {preprocessor, debug, watcher} = await mockPreprocessor(
    {},
    {files: [{pattern: fixture, watched: true}], autoWatch: true, rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await preprocessor(await readFile(fixture), file);
  t.true(debug.secondCall.calledWith(match('Watching'), subModule));
  t.true(debug.thirdCall.calledWith(match('Watching'), module));
  t.true(watcher.add.firstCall.calledWith(match.array.deepEquals([subModule, module])));
  t.true(watcher.add.calledOnce);
});

test('Add dependency to watcher for file added with glob', async t => {
  const fixture = 'test/fixtures/basic.js';
  const glob = 'test/*/+(basic|nomatch).js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const module = path.resolve('test/fixtures/modules/module.js');
  const subModule = path.resolve('test/fixtures/modules/sub-module.js');
  const {preprocessor, watcher, debug} = await mockPreprocessor(
    {},
    {files: [{pattern: glob, watched: true}], autoWatch: true, rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await preprocessor(await readFile(fixture), file);
  t.true(debug.secondCall.calledWith(match('Watching'), subModule));
  t.true(debug.thirdCall.calledWith(match('Watching'), module));
  t.true(watcher.add.firstCall.calledWith(match.array.deepEquals([subModule, module])));
  t.true(watcher.add.calledOnce);
});

test('Do not add dependency to watcher if parent is not watched', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, watcher} = await mockPreprocessor(
    {},
    {autoWatch: true, files: [{pattern: fixture, watched: false}], rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await preprocessor(await readFile(fixture), file);
  t.true(watcher.add.notCalled);
});

test('Add dependency to watcher only once, even when its referenced multiple times', async t => {
  const dir = tempy.directory();
  const fixture = path.join(dir, 'basic.js');
  const otherFixture = path.join(dir, 'other-basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const moduleAlt = path.join(includePath, 'module-alt.js');
  const subModule = path.join(includePath, 'sub-module.js');
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug, watcher} = await mockPreprocessor(
    {},
    {
      autoWatch: true,
      files: [{pattern: fixture, watched: true}, {pattern: otherFixture, watched: true}],
      rollupPreprocessor: {options},
    }
  );
  const file = {originalPath: fixture};
  const otherFile = {originalPath: otherFixture};

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/module.js', moduleAlt),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
    copy('test/fixtures/basic.js', otherFixture),
  ]);
  await preprocessor(await readFile(fixture), file);
  t.true(debug.secondCall.calledWith(match('Watching'), subModule));
  t.true(debug.thirdCall.calledWith(match('Watching'), module));
  t.true(watcher.add.firstCall.calledWith(match.array.deepEquals([subModule, module])));
  debug.reset();
  await preprocessor(await readFile(otherFixture), otherFile);
  t.true(watcher.add.calledOnce);
  t.true(debug.calledOnce);
});

test('Add dependency to watcher only once if file is overwritten', async t => {
  const fixture = 'test/fixtures/basic.js';
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const module = path.resolve('test/fixtures/modules/module.js');
  const subModule = path.resolve('test/fixtures/modules/sub-module.js');
  const {preprocessor, debug, watcher, refreshFiles} = await mockPreprocessor(
    {},
    {files: [{pattern: fixture, watched: true}], autoWatch: true, rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await preprocessor(await readFile(fixture), file);
  t.true(debug.secondCall.calledWith(match('Watching'), subModule));
  t.true(debug.thirdCall.calledWith(match('Watching'), module));
  t.true(watcher.add.firstCall.calledWith(match.array.deepEquals([subModule, module])));
  t.true(watcher.add.calledOnce);
  debug.reset();
  watcher.emit('add', subModule);
  await preprocessor(await readFile(fixture), file);
  t.false(refreshFiles.calledTwice);
});

test('Remove dependency from watcher if not referenced anymore', async t => {
  const dir = tempy.directory();
  const fixture = path.join(dir, 'basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const moduleAlt = path.join(includePath, 'module-alt.js');
  const subModule = path.join(includePath, 'sub-module.js');
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug, watcher} = await mockPreprocessor(
    {},
    {autoWatch: true, files: [{pattern: fixture, watched: true}], rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/module.js', moduleAlt),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
  ]);
  await preprocessor(await readFile(fixture), file);
  watcher.add.reset();
  debug.reset();
  await outputFile(
    fixture,
    (await readFile(fixture))
      .toString()
      .replace(`import test from './modules/module';`, `import test from './modules/module-alt';`)
  );
  await preprocessor(await readFile(fixture), file);
  t.true(watcher.unwatch.firstCall.calledWith(match.array.deepEquals([module])));
  t.true(debug.thirdCall.calledWith(match('Stop watching'), module));
  t.true(watcher.add.firstCall.calledWith(match.array.deepEquals([moduleAlt])));
  t.true(debug.secondCall.calledWith(match('Watching'), moduleAlt));
  t.true(watcher.unwatch.calledOnce);
  t.true(watcher.add.calledOnce);
});

test('Do not remove dependency from watcher when unreferenced, if another file still depends on it', async t => {
  const dir = tempy.directory();
  const fixture = path.join(dir, 'basic.js');
  const otherFixture = path.join(dir, 'other-basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const moduleAlt = path.join(includePath, 'module-alt.js');
  const subModule = path.join(includePath, 'sub-module.js');
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug, watcher} = await mockPreprocessor(
    {},
    {
      autoWatch: true,
      files: [{pattern: fixture, watched: true}, {pattern: otherFixture, watched: true}],
      rollupPreprocessor: {options},
    }
  );
  const file = {originalPath: fixture};
  const otherFile = {originalPath: otherFixture};

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/module.js', moduleAlt),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
    copy('test/fixtures/basic.js', otherFixture),
  ]);
  await preprocessor(await readFile(fixture), file);
  await preprocessor(await readFile(otherFixture), otherFile);
  watcher.add.reset();
  debug.reset();
  await outputFile(
    fixture,
    (await readFile(fixture))
      .toString()
      .replace(`import test from './modules/module';`, `import test from './modules/module-alt';`)
  );
  await preprocessor(await readFile(fixture), file);
  t.true(watcher.add.firstCall.calledWith(match.array.deepEquals([path.resolve(moduleAlt)])));
  t.true(watcher.unwatch.notCalled);
  t.true(debug.calledTwice);
});

test('Do not remove dependency from watcher when different files have differents childs', async t => {
  const dir = tempy.directory();
  const fixture = path.join(dir, 'basic.js');
  const otherFixture = path.join(dir, 'other-basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const moduleAlt = path.join(includePath, 'module-alt.js');
  const subModule = path.join(includePath, 'sub-module.js');
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, debug, watcher} = await mockPreprocessor(
    {},
    {
      autoWatch: true,
      files: [{pattern: fixture, watched: true}, {pattern: otherFixture, watched: true}],
      rollupPreprocessor: {options},
    }
  );
  const file = {originalPath: fixture};
  const otherFile = {originalPath: otherFixture};

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/module.js', moduleAlt),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
    copy('test/fixtures/basic.js', otherFixture),
  ]);
  await outputFile(
    fixture,
    (await readFile(fixture))
      .toString()
      .replace(`import test from './modules/module';`, `import test from './modules/module-alt';`)
  );
  await preprocessor(await readFile(fixture), file);
  watcher.add.reset();
  debug.reset();
  await preprocessor(await readFile(otherFixture), otherFile);
  t.true(watcher.add.calledOnce);
  t.true(watcher.unwatch.notCalled);
  t.true(debug.calledTwice);
});

test('Call refreshFiles when dependency is modified', async t => {
  const dir = tempy.directory();
  const fixture = path.join(dir, 'basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const subModule = path.join(includePath, 'sub-module.js');
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, watcher, info, refreshFiles} = await mockPreprocessor(
    {},
    {autoWatch: true, files: [{pattern: fixture, watched: true}], rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
  ]);
  await preprocessor(await readFile(fixture), file);
  const change = waitFor(watcher, 'change');

  watcher.emit('change', module);
  t.is(path.resolve(module), await change);
  t.true(info.firstCall.calledWith(match('Changed file'), path.resolve(module)));
  t.true(info.calledOnce);
  t.true(refreshFiles.calledOnce);
});

test('Call refreshFiles when dependency is deleted and added', async t => {
  const dir = tempy.directory();
  const fixture = path.join(dir, 'basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const subModule = path.join(includePath, 'sub-module.js');
  const options = {
    output: {format: 'umd'},
    plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
  };
  const {preprocessor, watcher, info, refreshFiles} = await mockPreprocessor(
    {},
    {autoWatch: true, files: [{pattern: fixture, watched: true}], rollupPreprocessor: {options}}
  );
  const file = {originalPath: fixture};

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
  ]);
  await preprocessor(await readFile(fixture), file);
  const del = waitFor(watcher, 'unlink');

  remove(module);
  watcher.emit('unlink', module);
  t.is(path.resolve(module), await del);
  t.true(info.firstCall.calledWith(match('Deleted file'), path.resolve(module)));
  t.true(info.calledOnce);
  t.true(refreshFiles.calledOnce);
  info.reset();
  refreshFiles.reset();
  await t.throws(preprocessor(await readFile(fixture), file), Error);
  const cpy = waitFor(watcher, 'add');

  await copy('test/fixtures/modules/module.js', module);
  watcher.emit('add', module);
  t.is(path.resolve(module), await cpy);
  t.true(info.firstCall.calledWith(match('Added file'), path.resolve(module)));
  t.true(info.calledOnce);
  t.true(refreshFiles.calledOnce);
  await preprocessor(await readFile(fixture), file);
});
