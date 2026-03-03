const nextCoreWebVitals = require('eslint-config-next/core-web-vitals');
const jsxA11y = require('eslint-plugin-jsx-a11y');

module.exports = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  ...nextCoreWebVitals,
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      // Enabled by Next's flat config but not by the legacy eslintrc config.
      // This repo currently uses setState-in-effect patterns in many places.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
