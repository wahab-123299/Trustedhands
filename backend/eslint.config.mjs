import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },

  {
    files: ["**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
]);