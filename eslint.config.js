// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // The `expo lint` wrapper's import resolver cannot resolve
      // react-native-svg (plain eslint resolves it fine, and TypeScript
      // catches real path typos anyway).
      'import/no-unresolved': ['error', { ignore: ['react-native-svg'] }],
    },
  },
]);
