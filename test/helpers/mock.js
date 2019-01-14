import {EventEmitter} from 'events';
import proxyquire from 'proxyquire';
import {spy, stub} from 'sinon';
import pify from 'pify';

/**
 * @typedef {Object} MockPreprocessor
 * @property {Function} preprocessor The preprocessor function.
 * @property {Spy} debug A spied debug log function.
 * @property {Spy} error A spied error log function.
 * @property {Spy} info A spied info log function.
 * @property {Spy} refreshFiles A spied server's refreshFiles function.
 * @property {EventEmitter} watcher The preprocessor local watcher.
 * @property {Spy} watcher.add A spied watcher's add function.
 * @property {Spy} watcher.unwatch A spied watcher's unwatch function.
 * @property {Stub} FSWatcher A stubbed local watcher constructor.
 */

/**
 * @typedef {Object} MockFactory
 * @property {Oject} factory The preprocessor factory.
 * @property {Promise<EventEmitter>} watcher a Promise that resolves to preprocessor local watcher.
 * @property {Stub} FSWatcher A stubbed local watcher constructor.
 */

/**
 * Create a mocked preprocessor factory.
 *
 * @method mockFactory
 * @param {Boolean} autoWatch `true` for autoWatch mode, `false` for a single run.
 * @return {MockFactory} mocked preprocessor factory and watcher.
 */
export function mockFactory(autoWatch) {
	const FSWatcher = stub();

	return {
		factory: proxyquire('../../lib/index', {chokidar: {FSWatcher}}),
		watcher: pify(callback => {
			if (autoWatch) {
				return FSWatcher.callsFake(() => {
					const emitter = new EventEmitter();
					const add = spy();
					const unwatch = spy();

					emitter.add = add;
					emitter.unwatch = unwatch;
					callback(null, emitter);
					return emitter;
				});
			}

			FSWatcher.returns(new EventEmitter());
			return callback(null);
		})(),
		FSWatcher,
	};
}

/**
 * Create a mocked preprocessor.
 *
 * @method mockPreprocessor
 * @param {Object} [args={}] custom preprocessor config to pass to the factory.
 * @param {Object} [config={}] Karma config to pass to the factory.
 * @return {MockPreprocessor} mocked preprocessor function and spies.
 */
export async function mockPreprocessor(args = {}, config = {}) {
	const debug = spy();
	const error = spy();
	const info = spy();
	const refreshFiles = spy();
	const {factory, watcher, FSWatcher} = mockFactory(config.autoWatch);
	const preprocessor = pify(
		factory['preprocessor:rollup'][1](
			args,
			config,
			{
				create() {
					return {debug, error, info};
				},
			},
			{refreshFiles}
		)
	);

	return {preprocessor, debug, error, info, refreshFiles, watcher: await watcher, FSWatcher};
}
