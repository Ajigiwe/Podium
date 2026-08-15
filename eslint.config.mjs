import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Throwaway experiments, not part of the app build.
    "scratch/**",
  ]),
  {
    rules: {
      // Reported as a warning rather than an error. The codebase has a large number
      // of pre-existing `any` usages (mostly Firestore/LiveKit payloads) that are
      // being typed incrementally; treating them as errors drowned out real problems.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
