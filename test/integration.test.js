import path from 'path';
import {utimes, copy, readFile, outputFile} from 'fs-extra';
import test from 'ava';
import pTimeout from 'p-timeout';
import babel from 'rollup-plugin-babel';
import {stub, match} from 'sinon';
import {run, watch, waitForRunComplete} from './helpers/karma';
import {tmp} from './helpers/utils';

let stubWrite;

test.before(() => {
  stubWrite = stub(process.stdout, 'write');
});

test.after(() => {
  stubWrite.restore();
});

test('Compile JS file', async t => {
  const {success, error, disconnected} = await run('test/fixtures/basic.js', {
    options: {format: 'umd', plugins: [babel({babelrc: false, presets: [['es2015', {modules: false}]]})]},
  });

  t.ifError(error, 'Karma returned an error');
  t.ifError(disconnected, 'Karma disconnected');
  t.is(success, 1, 'Expected 1 test successful');
});

test('Compile JS file with sourcemap and verify the reporter logs use the sourcemap', async t => {
  const {success, failed, error, disconnected} = await run('test/fixtures/falsy-assert.js', {
    options: {
      sourcemap: true,
      format: 'umd',
      plugins: [babel({babelrc: false, presets: [['es2015', {modules: false}]]})],
    },
  });

  t.true(
    stubWrite.calledWith(
      match(
        /[\s\S]*(Expected false to be truthy)[\s\S]*(test\/fixtures\/falsy-assert\.js:7:4 <- test\/fixtures\/falsy-assert\.js:20:29)[\s\S]*/g
      )
    )
  );
  t.ifError(disconnected, 'Karma disconnected');
  t.true(error, 'Expected an error to be returned');
  t.is(success, 0, 'Expected 0 test successful');
  t.is(failed, 1, 'Expected 1 test to be failed');
});

test('Compile JS file with custom preprocessor', async t => {
  const {success, error, disconnected} = await run('test/fixtures/basic.custom.js', {
    options: {format: 'umd', plugins: [babel({babelrc: false, presets: [['es2015', {modules: false}]]})]},
  });

  t.ifError(error, 'Karma returned an error');
  t.ifError(disconnected, 'Karma disconnected');
  t.is(success, 1, 'Expected 1 test successful');
});

test('Log error on invalid JS file', async t => {
  const {error, disconnected, exitCode} = await run('test/fixtures/error.js');

  t.ifError(disconnected, 'Karma disconnected');
  t.true(error, 'Expected an error to be returned');
  t.is(exitCode, 1, 'Expected non zero exit code');
});

test('Re-compile JS file when dependency is modified', async t => {
  const dir = path.resolve(tmp());
  const fixture = path.join(dir, 'basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const subModule = path.join(includePath, 'sub-module.js');

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
  ]);
  console.log(fixture.replace('fixtures', '*').replace('basic', '+(js|nomatch)'));
  const server = await watch([fixture.replace('fixtures', '*').replace('basic', '+(basic|nomatch)')], {
    options: {format: 'umd', plugins: [babel({babelrc: false, presets: [['es2015', {modules: false}]]})]},
  });

  try {
    let {success, error, disconnected} = await waitForRunComplete(server);

    t.ifError(error, 'Karma returned an error');
    t.ifError(disconnected, 'Karma disconnected');
    t.is(success, 1, 'Expected 1 test successful');

    utimes(module, Date.now() / 1000, Date.now() / 1000);
    ({success, error, disconnected} = await waitForRunComplete(server));

    t.ifError(error, 'Karma returned an error');
    t.ifError(disconnected, 'Karma disconnected');
    t.is(success, 1, 'Expected 1 test successful');
  } finally {
    await server.emitAsync('exit');
  }
});

test('Do not recompile scss file when dependency is not imported anymore', async t => {
  const dir = path.resolve(tmp());
  const fixture = path.join(dir, 'basic.js');
  const includePath = path.join(dir, 'modules');
  const module = path.join(includePath, 'module.js');
  const moduleAlt = path.join(includePath, 'module-alt.js');
  const subModule = path.join(includePath, 'sub-module.js');

  await Promise.all([
    copy('test/fixtures/modules/module.js', module),
    copy('test/fixtures/modules/module.js', moduleAlt),
    copy('test/fixtures/modules/sub-module.js', subModule),
    copy('test/fixtures/basic.js', fixture),
  ]);
  const server = await watch([fixture], {
    options: {format: 'umd', plugins: [babel({babelrc: false, presets: [['es2015', {modules: false}]]})]},
  });

  try {
    let {success, error, disconnected} = await waitForRunComplete(server);

    t.ifError(error, 'Karma returned an error');
    t.ifError(disconnected, 'Karma disconnected');
    t.is(success, 1, 'Expected 1 test successful');
    await outputFile(
      fixture,
      (await readFile(fixture))
        .toString()
        .replace(`import test from './modules/module';`, `import test from './modules/module-alt';`)
    );
    ({success, error, disconnected} = await waitForRunComplete(server));
    t.ifError(error, 'Karma returned an error');
    t.ifError(disconnected, 'Karma disconnected');
    t.is(success, 1, 'Expected 1 test successful');

    utimes(module, Date.now() / 1000, Date.now() / 1000);
    await t.throws(waitForRunComplete(server), pTimeout.TimeoutError);
  } finally {
    await server.emitAsync('exit');
  }
});
