import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],

    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.config.{js,ts}",
      "vite.config.ts"
    ],

    plugins: {
      "unused-imports": unusedImports,
    },

    rules: {
      "unused-imports/no-unused-imports": "warn",

      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",

      "prefer-const": "error",
      "no-var": "error",
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  }
);
