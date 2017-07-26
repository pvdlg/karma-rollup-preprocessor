import proxyquire from 'proxyquire';
import {spy, stub} from 'sinon';
import pify from 'pify';
import chokidar from 'chokidar';

/**
 * @typedef {Object} Mock
 * @property {Function} preprocessor The preprocessor function.
 * @property {Spy} debug A spied debug log function.
 * @property {Spy} error A spied error log function.
 * @property {Spy} info A spied info log function.
 * @property {Spy} refreshFiles A spied server's refreshFiles function.
 * @property {Spy} add A spied watcher's add function.
 * @property {Spy} unwatch A spied watcher's unwatch function.
 * @property {FSWatcher} watcher The preprocessor local watcher.
 * @property {Stub} FSWatcher A stubbed local watcher constructor.
 */

/**
 * Create a mocked preprocessor.
 * 
 * @method mockPreprocessor
 * @param {Object} [args={}] custom preprocessor config to pass to the factory.
 * @param {Object} [config={}] Karma config to pass to the factory.
 * @return {Object} mocked preprocessor function and spies.
 */
export default function mockPreprocessor(args = {}, config = {}) {
  let add;
  let unwatch;
  let watcher;
  const FSWatcher = stub().callsFake((...watcherArgs) => {
    watcher = new chokidar.FSWatcher(...watcherArgs);
    add = spy(watcher, 'add');
    unwatch = spy(watcher, 'unwatch');
    return watcher;
  });
  const debug = spy();
  const error = spy();
  const info = spy();
  const refreshFiles = spy();
  const preprocessor = pify(
    proxyquire('../../lib/index', {chokidar: {FSWatcher}})['preprocessor:rollup'][1](
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

  return {preprocessor, debug, error, info, refreshFiles, add, unwatch, watcher, FSWatcher};
}
