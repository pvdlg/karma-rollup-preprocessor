/* eslint-env jasmine */
import test from './modules/module';

describe('JS module', () => {
	it('shoud be defined', () => {
		expect(test).toBeDefined();
		expect(test.subModule).toBeDefined();
		expect(false).toBeTruthy();
		expect(test.subModule).toEqual(jasmine.any(Function));
	});
});
