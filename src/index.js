import path from 'path';
import {merge} from 'lodash';
import {FSWatcher} from 'chokidar';
import nodeify from 'nodeify';
import minimatch from 'minimatch';
import {rollup} from 'rollup';

/**
 * Rollup preprocessor factory.
 *
 * @param {Object} args Config object of custom preprocessor.
 * @param {Object} [config={}] Karma's config.
 * @param {Object} logger Karma's logger.
 * @param {Object} server Karma's server.
 * @return {Function} the function to preprocess files.
 */
function createRollupPreprocessor(args, config, logger, server) {
	const preprocessorConfig = config.rollupPreprocessor || {};
	const log = logger.create('preprocessor.rollup');
	const options = merge({sourcemap: false}, args.options || {}, preprocessorConfig.options || {});
	const transformPath =
		args.transformPath ||
		preprocessorConfig.transformPath ||
		(filepath => `${path.dirname(filepath)}/${path.basename(filepath, path.extname(filepath))}.js`);
	let watcher;
	const dependencies = {};
	const unlinked = [];
	let cache;

	if (config.autoWatch) {
		watcher = new FSWatcher({persistent: true, disableGlobbing: true})
			.on('change', filePath => {
				log.info('Changed file "%s".', filePath);
				server.refreshFiles();
			})
			.on('add', filePath => {
				if (unlinked.indexOf(filePath) !== -1) {
					log.info('Added file "%s".', filePath);
					server.refreshFiles();
				}
			})
			.on('unlink', filePath => {
				log.info('Deleted file "%s".', filePath);
				unlinked.push(filePath);
				server.refreshFiles();
			});
	}

	return (content, file, done) => {
		log.debug('Processing "%s".', file.originalPath);
		file.path = transformPath(file.originalPath);

		// Clone the options because we need to mutate them
		const opts = Object.assign({}, options);

		if (!opts.output) {
			opts.output = {};
		}
		// Inline source maps
		if (opts.sourcemap || opts.output.sourcemap) {
			opts.output.sourcemap = 'inline';
		}
		opts.input = file.originalPath;
		opts.cache = cache;

		nodeify(
			rollup(opts)
				.then(bundle => {
					if (
						config.autoWatch &&
						config.files.find(
							configFile => configFile.watched && minimatch(file.originalPath, configFile.pattern, {dot: true})
						)
					) {
						const fullPath = path.resolve(file.originalPath);
						const includedFiles = [];
						const startWatching = [];
						const stopWatching = [];

						for (let i = 0, {length} = bundle.modules; i < length; i++) {
							if (bundle.modules[i].id !== fullPath && !bundle.modules[i].id.startsWith('\u0000')) {
								includedFiles.push(bundle.modules[i].id);
								if (!dependencies[bundle.modules[i].id]) {
									startWatching.push(bundle.modules[i].id);
									log.debug('Watching "%s"', bundle.modules[i].id);
									dependencies[bundle.modules[i].id] = [fullPath];
								} else if (dependencies[bundle.modules[i].id].indexOf(fullPath) === -1) {
									dependencies[bundle.modules[i].id].push(fullPath);
								}
							}
						}
						for (let i = 0, keys = Object.keys(dependencies), {length} = keys; i < length; i++) {
							if (includedFiles.indexOf(keys[i]) === -1) {
								const index = dependencies[keys[i]].indexOf(fullPath);

								if (index !== -1) {
									dependencies[keys[i]].splice(index, 1);
									if (!dependencies[keys[i]].length > 0) {
										stopWatching.push(keys[i]);
										log.debug('Stop watching "%s"', keys[i]);
										delete dependencies[keys[i]];
									}
								}
							}
						}

						if (startWatching.length > 0) {
							watcher.add(startWatching);
						}
						if (stopWatching.length > 0) {
							watcher.unwatch(stopWatching);
						}
					}
					cache = bundle;
					return bundle.generate(opts.output);
				})
				.then(generated => {
					if (opts.output.sourcemap && generated.map) {
						generated.map.file = path.basename(file.path);
						file.sourceMap = generated.map;
						return `${generated.code}\n//# sourceMappingURL=${generated.map.toUrl()}\n`;
					}
					return generated.code;
				})
				.catch(err => {
					log.error('Failed to process %s\n%s\n', file.originalPath, err.message);
					throw err;
				}),
			done
		);
	};
}

// Inject dependencies
createRollupPreprocessor.$inject = ['args', 'config', 'logger', 'emitter'];

// Export preprocessor
module.exports = {'preprocessor:rollup': ['factory', createRollupPreprocessor]};
