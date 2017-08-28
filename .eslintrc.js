module.exports = {
  extends: ['pretty/es6', 'pretty/node', 'pretty/promise', 'pretty/jasmine', 'pretty/ava', 'pretty/prettier'],
  parserOptions: {sourceType: 'module'},
  env: {jquery: true, browser: true},
  globals: {readFixtures: true, appendSetFixtures: true},
};
