// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import test from './modules/module_2';

describe('JS module', () => {
  it('shoud be defined', () => {
    expect(test).toBeDefined();
    expect(test.subModule).toBeDefined();
    expect(test.subModule).toEqual(jasmine.any(Function));
  });
});
