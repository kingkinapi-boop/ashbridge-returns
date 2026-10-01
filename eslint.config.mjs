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
)
