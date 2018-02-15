import path from 'path';
import {copy} from 'fs-extra';
import test from 'ava';
import {stub, match} from 'sinon';
import tempy from 'tempy';
import babel from 'rollup-plugin-babel';
import {run, watch, waitForRunComplete} from './helpers/karma';

let stubWrite;

test.before(() => {
	stubWrite = stub(process.stdout, 'write');
});

test.after(() => {
	stubWrite.restore();
});

test.serial('Compile JS file', async t => {
	const {success, error, disconnected, errMsg} = await run('test/fixtures/basic.js', {
		options: {
			output: {format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
		},
	});

	t.ifError(error, `Karma returned the error: ${errMsg}`);
	t.ifError(disconnected, 'Karma disconnected');
	t.is(success, 1, 'Expected 1 test successful');
});

test.serial('Compile JS file with sourcemap and verify the reporter logs use the sourcemap', async t => {
	const {success, failed, error, disconnected} = await run('test/fixtures/falsy-assert.js', {
		options: {
			output: {sourcemap: true, format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
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

test.serial('Compile JS file with custom preprocessor', async t => {
	const {success, error, disconnected, errMsg} = await run('test/fixtures/basic.custom.js', {
		options: {
			output: {format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
		},
	});

	t.ifError(error, `Karma returned the error: ${errMsg}`);
	t.ifError(disconnected, 'Karma disconnected');
	t.is(success, 1, 'Expected 1 test successful');
});

test.serial('Log error on invalid JS file', async t => {
	const {error, disconnected, exitCode} = await run('test/fixtures/error.js');

	t.ifError(disconnected, 'Karma disconnected');
	t.true(error, 'Expected an error to be returned');
	t.is(exitCode, 1, 'Expected non zero exit code');
});

test('Re-compile JS file when dependency is modified', async t => {
	const dir = tempy.directory();
	const fixture = path.join(dir, 'basic.js');
	const includePath = path.join(dir, 'modules');
	const module = path.join(includePath, 'module.js');
	const subModule = path.join(includePath, 'sub-module.js');

	await Promise.all([
		copy('test/fixtures/modules/module.js', module),
		copy('test/fixtures/modules/sub-module.js', subModule),
		copy('test/fixtures/basic.js', fixture),
	]);

	const {server, watcher} = await watch([fixture.replace('fixtures', '*').replace('basic', '+(basic|nomatch)')], {
		options: {
			output: {format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('babel-preset-es2015'), {modules: false}]]})],
		},
	});

	try {
		let {success, error, disconnected, errMsg} = await waitForRunComplete(server);

		t.ifError(error, `Karma returned the error: ${errMsg}`);
		t.ifError(disconnected, 'Karma disconnected');
		t.is(success, 1, 'Expected 1 test successful');
		watcher.emit('change', module);
		({success, error, disconnected, errMsg} = await waitForRunComplete(server));

		t.ifError(error, `Karma returned the error: ${errMsg}`);
		t.ifError(disconnected, 'Karma disconnected');
		t.is(success, 1, 'Expected 1 test successful');
	} finally {
		await server.emitAsync('exit');
	}
});
