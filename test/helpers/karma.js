import pEvent from 'p-event';
import tempDir from 'temp-dir';
import {Server, constants} from 'karma';
import karmaPreprocessor from '../../lib';
import {mockFactory} from './mock';

/**
 * Base Karma configuration tu run preprocessor.
 *
 * @type {Object}
 */
const KARMA_CONFIG = {
	basePath: '',
	frameworks: ['jasmine'],
	preprocessors: {
		'test/fixtures/**/!(*custom).js': ['rollup'],
		'test/fixtures/**/*custom.js': ['custom_rollup'],
		[`${tempDir}/**/!(*custom).js`]: ['rollup'],
		[`${tempDir}/**/*custom.js`]: ['custom_rollup'],
	},
	colors: true,
	logLevel: constants.LOG_DISABLE,
	browsers: ['PhantomJS'],
};

/**
 * @typedef {Object} KarmaOutput
 * @property {Number} success
 * @property {Number} failed
 * @property {Boolean} error
 * @property {Boolean} disconnected
 * @property {Boolean} exitCode
 * @property {String} errMsg
 */

/**
 * Run Karma for a sungle run with:
 * - Base Karma configuration {@link KARMA_CONFIG}
 * - JS to compile with the preprocessor and unit test to run
 * - preprocessor options
 *
 * @method run
 * @param {Array<string>} files path of the js files and unit tests.
 * @param {Object} [config] configuration to pass to the preprocessor.
 * @return {Promise<KarmaOutput>} A `Promise` that resolve to the Karma execution results.
 */
export function run(files, config) {
	const server = createServer(files, config, false, karmaPreprocessor);
	const result = waitForRunComplete(server);

	server.start();
	return result;
}

/**
 * Run Karma in autoWatch mode with:
 * - Base Karma configuration {@link KARMA_CONFIG}
 * - JS to compile with the preprocessor and unit test to run
 * - preprocessor options
 *
 * @method run
 * @param {Array<string>} files path of the js files and unit tests.
 * @param {Object} [config] configuration to pass to the preprocessor.
 * @return {Server} The started Karma Server.
 */
export async function watch(files, config) {
	const {factory, watcher} = mockFactory(true);
	const server = createServer(files, config, true, factory);

	server.start();
	return {server, watcher: await watcher};
}

/**
 * Create a Karma {@link Server}.
 *
 * @method createServer
 * @param {Array<string>} files path of the js files and unit tests.
 * @param {Object} [config] configuration to pass to the preprocessor.
 * @param {boolean} autoWatch `true` for autoWatch mode, `false` for a single run.
 * @param {Object} processorFactory Karma plugin factory.
 * @return {Server} the configured Karma Server.
 */
function createServer(files, config, autoWatch, processorFactory) {
	return new Server(
		Object.assign(KARMA_CONFIG, {
			files: Array.isArray(files) ? files : [files],
			rollupPreprocessor: config,
			customPreprocessors: {custom_rollup: Object.assign({base: 'rollup'}, config)}, // eslint-disable-line camelcase
			singleRun: !autoWatch,
			autoWatch,
			plugins: ['karma-*', processorFactory],
		}),
		() => 0
	);
}

/**
 * Return a Promise that resolve when a run is completed by the Karma server in parameter.
 *
 * @method waitForRunComplete
 * @param {Server} server A Karma server started in autoWatch mode.
 * @return {Promise<KarmaOutput>} A `Promise` that resolve to the Karma execution results.
 */
export async function waitForRunComplete(server) {
	try {
		const [, result] = await pEvent(server, 'run_complete', {
			multiArgs: true,
			timeout: 30000,
			rejectionEvents: ['browser_error'],
		});

		return result;
	} catch (error) {
		if (Array.isArray(error)) {
			console.log(error);
			const [
				{
					lastResult: {success, failed, error: err, disconnected},
				},
				errMsg,
			] = error;

			return {success, failed, error: err, disconnected, exitCode: 1, errMsg};
		}
		throw error;
	}
}
