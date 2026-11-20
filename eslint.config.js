import js from "@eslint/js"
import globals from "globals"
import i18next from "eslint-plugin-i18next"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores([
    "dist",
    ".pnpm-store",
    "playwright-report",
    "test-results",
    "src/lib/grpc",
    "src/components/ui",
    "src/hooks/use-toast.ts",
    "src/hooks/use-mobile.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Every user-visible string must come from the translation catalogs
    // (spec §4.2); attributes that screen readers or tooltips expose count too.
    files: ["src/**/*.tsx"],
    ignores: ["src/**/*.test.tsx"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: ["^(title|placeholder|alt|label|aria-label|aria-description)$"],
          },
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts", "*.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Playwright fixtures receive a `use` callback that is not a React hook.
    files: ["tests/e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
])
