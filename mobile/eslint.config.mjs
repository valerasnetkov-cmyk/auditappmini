import expoConfig from 'eslint-config-expo/flat.js'

export default [
  ...expoConfig,
  {
    ignores: [
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'coverage/**',
    ],
  },
]
