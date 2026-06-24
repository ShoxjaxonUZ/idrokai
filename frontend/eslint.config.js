import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // localStorage/sessionStorage himoyalari ataylab bo'sh catch ishlatadi
      'no-empty': ['error', { allowEmptyCatch: true }],
      // set-state-in-effect — performance maslahati, xato emas (warn yetarli)
      'react-hooks/set-state-in-effect': 'warn',
      // ── React Compiler qoidalari ──
      // Bu loyiha React Compiler ishlatmaydi. Quyidagi qoidalar compiler uchun
      // mo'ljallangan va oddiy (qo'lda yozilgan) React'da soxta signal beradi:
      //  - immutability: useEffect ichida keyinroq e'lon qilingan funksiyani chaqirish
      //    (hoisting tufayli runtime'da to'g'ri ishlaydi)
      //  - purity: render'da Date.now() (relativ vaqt) — keng tarqalgan, xavfsiz
      // Klassik 'rules-of-hooks' va 'exhaustive-deps' yoqilgan holicha qoladi.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      // refs: render vaqtida ref.current = value yozish klassik React'da ruxsat etilgan
      // (React Compiler uchun qo'shimcha cheklov, bu loyihada Compiler yo'q)
      'react-hooks/refs': 'off',
      // Context fayllari provider + hook eksport qiladi — HMR'ga ta'sir qiladi, bug emas
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Node muhitida ishlaydigan config va skript fayllar
    files: ['vite.config.js', 'postcss.config.js', 'tailwind.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
