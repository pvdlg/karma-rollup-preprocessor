module.exports = {
  extends: [
    '@metahub/eslint-config/es6-config',
    '@metahub/eslint-config/node-config',
    '@metahub/eslint-config/promise-config',
    '@metahub/eslint-config/jasmine-config',
    '@metahub/eslint-config/ava-config',
    '@metahub/eslint-config/prettier-config',
  ],
  parserOptions: {sourceType: 'module'},
  env: {jquery: true, browser: true},
  globals: {readFixtures: true, appendSetFixtures: true},
};
