/* eslint-env jasmine */
// eslint-disable-next-line import/no-unresolved
import test from './modules/module_2';

describe('JS module', () => {
	it('shoud be defined', () => {
		expect(test).toBeDefined();
		expect(test.subModule).toBeDefined();
		expect(test.subModule).toEqual(jasmine.any(Function));
	});
});
