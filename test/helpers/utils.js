import path from 'path';
import uuid from 'uuid';
import pEvent from 'p-event';
import {rollup} from 'rollup';

/**
 * Generate a unique temporary file/directory path.
 *
 * @param {String} filename file/directory name to create under 'test/fixtures/.tmp'.
 * @return {String} the path of the unique temporary file/directory.
 */
export function tmp(filename) {
  return path.join('test/fixtures/.tmp', uuid(), filename || '');
}

/**
 * Return a Promise that resolve after a delay.
 * 
 * @method sleep
 * @param {Number} delay time after which to resolve the Promise.
 * @return {Promise} a Promise that resolve after a delay.
 */
export function sleep(delay) {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

/* eslint-disable no-magic-numbers */
/**
 * Return a Promise that resolve when an event is emitted and reject after a timeout expire if the event is not emitted.
 *
 * @method waitFor
 * @param {Object} emitter object that emit events.
 * @param {string} event event to listen to.
 * @param {Number} [timeout=30000] maximum time to wait for the event to be emitted.
 * @return {Promise} Promise tht resolve when the event is emitted.
 */
export function waitFor(emitter, event, timeout = 30000) {
  return pEvent(emitter, event, {timeout});
}

/**
 * @typedef {Object} Compiled
 * @property {string} code the compiled javascript code.
 * @property {Object} map the sourcemap resulting from the compilation.
 */

/* eslint-enable no-magic-numbers */
/**
 * Compile a js file and return the result as a `string`.
 *  
 * @method compile
 * @param {string} file path of the file to compile.
 * @param {Object} [options={}] rollup options.
 * @return {Compiled} compiled code and source map.
 */
export async function compile(file, options = {}) {
  if (options.sourceMap) {
    options.sourceMap = 'inline';
  }
  options.entry = file;
  const {code, map} = await (await rollup(options)).generate(options);

  if (map) {
    map.file = path.basename(file);
  }
  return {code: options.sourceMap ? `${code}\n//# sourceMappingURL=${map.toUrl()}\n` : code, map};
}
