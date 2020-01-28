const path = require('path');
const {copy} = require('fs-extra');
const test = require('ava');
const {stub, match} = require('sinon');
const tempy = require('tempy');
const babel = require('rollup-plugin-babel');
const {run, watch, waitForRunComplete} = require('./helpers/karma');

/* eslint prefer-named-capture-group: "off" */

let stubWrite;

test.before(() => {
	stubWrite = stub(process.stdout, 'write');
});

test.after(() => {
	stubWrite.restore();
});

test.serial('Compile JS file', async t => {
	const {success, error, disconnected} = await run('test/fixtures/basic.js', {
		options: {
			output: {format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('@babel/preset-env'), {modules: false}]]})],
		},
	});

	t.falsy(error, `Karma returned an error`);
	t.falsy(disconnected, 'Karma disconnected');
	t.is(success, 1, 'Expected 1 test successful');
});

test.serial('Compile JS file with sourcemap and verify the reporter logs use the sourcemap', async t => {
	const {success, failed, disconnected} = await run('test/fixtures/falsy-assert.js', {
		options: {
			output: {sourcemap: true, format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('@babel/preset-env'), {modules: false}]]})],
		},
	});

	t.true(
		stubWrite.calledWith(
			match(
				/[\s\S]*(Expected false to be truthy)[\s\S]*(test\/fixtures\/falsy-assert\.js:\d+:\d+ <- test\/fixtures\/falsy-assert\.js:\d+:\d+)[\s\S]*/g
			)
		)
	);

	t.falsy(disconnected, 'Karma disconnected');
	t.is(success, 0, 'Expected 0 test successful');
	t.is(failed, 1, 'Expected 1 test to be failed');
});

test.serial('Compile JS file with custom preprocessor', async t => {
	const {success, error, disconnected} = await run('test/fixtures/basic.custom.js', {
		options: {
			output: {format: 'umd'},
			plugins: [babel({babelrc: false, presets: [[require.resolve('@babel/preset-env'), {modules: false}]]})],
		},
	});

	t.falsy(error, `Karma returned an error`);
	t.falsy(disconnected, 'Karma disconnected');
	t.is(success, 1, 'Expected 1 test successful');
});

test.serial('Log error on invalid JS file', async t => {
	const {error, disconnected, exitCode} = await run('test/fixtures/error.js');

	t.falsy(disconnected, 'Karma disconnected');
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
			plugins: [babel({babelrc: false, presets: [[require.resolve('@babel/preset-env'), {modules: false}]]})],
		},
	});

	try {
		let {success, error, disconnected} = await waitForRunComplete(server);

		t.falsy(error, `Karma returned an error`);
		t.falsy(disconnected, 'Karma disconnected');
		t.is(success, 1, 'Expected 1 test successful');
		watcher.emit('change', module);
		({success, error, disconnected} = await waitForRunComplete(server));

		t.falsy(error, `Karma returned an error`);
		t.falsy(disconnected, 'Karma disconnected');
		t.is(success, 1, 'Expected 1 test successful');
	} finally {
		await server.emitAsync('exit');
	}
});
