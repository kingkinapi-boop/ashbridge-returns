import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'reports/**', 'playwright-report/**', 'test-results/**', 'tools/**', 'reference/**', 'blueprint/**', 'plan/**', '**/*.mjs', '**/*.cjs', '.claude/**', '.stryker-tmp/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
  {
    // Production code logs only through makeLogger, with a constant message (SEC-5).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name=/^(info|warn|error|debug)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]",
          message: 'A log message is a constant string: put data in fields.',
        },
        {
          selector: "CallExpression[callee.property.name=/^(info|warn|error|debug)$/] > BinaryExpression.arguments:first-child[operator='+']",
          message: 'A log message is a constant string: put data in fields.',
        },
      ],
    },
  },
  { files: ['src/core/db/global-setup.ts'], rules: { 'no-console': 'off' } },
)
