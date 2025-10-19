// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript"), {
  rules: {
    // Disable overly strict rules for development
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/no-unused-vars": "warn", // Warn instead of error
    "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error for gradual typing
    "@typescript-eslint/no-empty-object-type": "warn",
    "@typescript-eslint/no-require-imports": "warn", // Allow require in tests
    "react-hooks/exhaustive-deps": "warn", // Warn instead of error
    "react-hooks/rules-of-hooks": "error", // Keep this as error - it's critical
    "@next/next/no-img-element": "warn", // Warn about img elements
    "@next/next/no-html-link-for-pages": "warn",
    "react/display-name": "warn",
    "no-var": "warn",
    "@typescript-eslint/no-namespace": "warn",

    // Disable rules that are too noisy during development
    "@typescript-eslint/no-empty-interface": "off",
    "prefer-const": "warn",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}];

export default eslintConfig;