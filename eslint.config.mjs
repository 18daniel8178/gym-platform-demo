// Clean Code Gates: límites de tamaño, anidamiento y complejidad.
// Restricciones duras: si una función las supera, se refactoriza antes de continuar.
import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import { importX } from "eslint-plugin-import-x";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "client/dist/**",
    ],
  },
  js.configs.recommended,
  sonarjs.configs.recommended,
  importX.flatConfigs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    settings: {
      // El client importa componentes sin extensión (./components/Header → .jsx)
      "import-x/resolver": { node: { extensions: [".js", ".jsx", ".mjs", ".cjs"] } },
    },
    rules: {
      // --- Tamaño / "hace una sola cosa" ---
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 3],

      // --- Anidamiento ---
      "max-depth": ["error", 3],
      "max-nested-callbacks": ["error", 3],

      // --- Complejidad ---
      "complexity": ["error", { max: 10 }],
      "sonarjs/cognitive-complexity": ["error", 15],

      // Convención del repo: prefijo _ marca un parámetro deliberadamente sin usar
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      // --- Estructura de dependencias ---
      "import-x/no-cycle": ["error", { maxDepth: Infinity, ignoreExternal: true }],
    },
  },
  {
    // client: navegador + JSX (runtime automático de Vite: no se importa React)
    files: ["client/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // server + api (función serverless de Vercel): CommonJS + globals de Node
    files: ["server/**/*.js", "api/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  {
    // tooling que corre en Node (scripts de la demo, vite.config, scripts de assets)
    files: ["scripts/**/*.{js,mjs}", "client/scripts/**/*.{js,mjs}", "client/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    // Los tests pueden tener funciones "largas" (describe/it) → relaja ahí
    files: ["**/*.{test,spec}.{js,jsx}"],
    rules: {
      "max-lines-per-function": "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
];
