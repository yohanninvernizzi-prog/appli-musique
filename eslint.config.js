// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Les textes de l'interface sont en français : les apostrophes y sont partout et sans risque en React Native.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
  {
    ignores: ['dist/*', 'android/*', 'ios/*'],
  },
]);
