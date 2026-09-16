import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.{test,spec}.ts",
      "apps/generador-demo/src/**/*.{test,spec}.ts",
      "apps/dashboard/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "apps/dashboard/.next/**"],
    passWithNoTests: true,
    environment: "node",
    // Los tests de componentes React (.test.tsx) necesitan un DOM real
    // (jsdom) para poder montar y hacer aserciones sobre el markup
    // renderizado; el resto de la suite (lógica pura en packages/ y
    // apps/generador-demo, y los tests .test.ts de apps/dashboard) sigue
    // corriendo en el entorno "node" por defecto, sin cambios.
    environmentMatchGlobs: [["apps/dashboard/**/*.test.tsx", "jsdom"]],
  },
});
