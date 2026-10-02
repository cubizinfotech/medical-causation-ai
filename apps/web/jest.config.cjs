const { createDefaultPreset } = require('ts-jest');

const preset = createDefaultPreset();

module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: preset.transform,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
