import nkzw from '@nkzw/oxlint-config'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [nkzw],
  ignorePatterns: ['node_modules/**', 'dist/**'],
  overrides: [
    {
      // The stdio transport owns stdout, so stderr is the server's only log channel.
      files: ['src/index.ts'],
      rules: {
        'no-console': ['error', { allow: ['error'] }]
      }
    },
    {
      files: ['src/features/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                regex: String.raw`^(\.\./[^./][^/]*/|(\.\./)+features/)`,
                message:
                  'A feature must not import another feature. Move what both need to src/utils if it is domain-free, or pass it in from src/index.ts.'
              }
            ]
          }
        ]
      }
    },
    {
      files: ['src/utils/**', 'src/client/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                regex: String.raw`^(\.\.?/)+features(/|$)`,
                message:
                  'Shared code must not import a feature. Keep feature-specific code in its folder under src/features.'
              }
            ]
          }
        ]
      }
    }
  ]
})
