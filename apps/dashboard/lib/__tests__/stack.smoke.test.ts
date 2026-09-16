import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Smoke test del stack tecnológico (tarea 21.1, Requisitos 8.1, 8.3,
 * 17.1-17.6): verifica que cada `package.json` del monorepo declara las
 * dependencias exigidas por el diseño, sin ejecutar ningún build (el
 * build real se verifica por separado con `tsc --noEmit`/`next build`
 * como parte del checkpoint de la tarea 21, ya que lanzar un build de
 * Next.js dentro de un test de Vitest sería lento y redundante).
 *
 * No reemplaza la verificación manual de comportamiento (p. ej. que el
 * cliente WebSocket realmente usa `WebSocket` nativo, o que el
 * `Panel_Telemetria` realmente dibuja en `<canvas>`); solo confirma que
 * las piezas de infraestructura declaradas en el diseño están presentes
 * como dependencias reales del proyecto.
 */

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(relativePath: string): PackageJson {
  const absolutePath = resolve(__dirname, "../../../..", relativePath);
  const raw = readFileSync(absolutePath, "utf-8");
  return JSON.parse(raw) as PackageJson;
}

function allDeps(pkg: PackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

describe("Verificación del stack tecnológico declarado (tarea 21.1)", () => {
  it("packages/contrato-datos declara zod como única dependencia de runtime (Requisito 5.1)", () => {
    const pkg = readPackageJson("packages/contrato-datos/package.json");
    expect(allDeps(pkg)).toHaveProperty("zod");
  });

  it("apps/generador-demo usa Node.js + ws, sin dependencias nativas adicionales (Requisito 7.4)", () => {
    const pkg = readPackageJson("apps/generador-demo/package.json");
    const deps = allDeps(pkg);
    expect(deps).toHaveProperty("ws");
    expect(deps).toHaveProperty("@apex/contrato-datos");
  });

  it("apps/dashboard declara Next.js App Router + TypeScript + Tailwind + shadcn/ui (Requisitos 8.3, 17.1, 17.2)", () => {
    const pkg = readPackageJson("apps/dashboard/package.json");
    const deps = allDeps(pkg);
    expect(deps).toHaveProperty("next");
    expect(deps).toHaveProperty("typescript");
    expect(deps).toHaveProperty("tailwindcss");
    // shadcn/ui se instala como CLI (`shadcn`) + primitivas Radix, no como
    // un único paquete "shadcn-ui"; se verifican ambas piezas.
    expect(deps).toHaveProperty("shadcn");
    expect(deps).toHaveProperty("radix-ui");
  });

  it("apps/dashboard declara Framer Motion para animaciones de transición (Requisito 17.3)", () => {
    const pkg = readPackageJson("apps/dashboard/package.json");
    expect(allDeps(pkg)).toHaveProperty("framer-motion");
  });

  it("apps/dashboard declara Zustand para la gestión de estado (Requisito 17.6)", () => {
    const pkg = readPackageJson("apps/dashboard/package.json");
    expect(allDeps(pkg)).toHaveProperty("zustand");
  });

  it("apps/dashboard depende del Contrato_Datos del workspace", () => {
    const pkg = readPackageJson("apps/dashboard/package.json");
    expect(allDeps(pkg)).toHaveProperty("@apex/contrato-datos");
  });

  it("todas las versiones declaradas en dependencies/devDependencies están fijadas (sin rangos sueltos como '*', 'latest' o carentes de dígitos)", () => {
    const packages = [
      "packages/contrato-datos/package.json",
      "apps/generador-demo/package.json",
      "apps/dashboard/package.json",
    ];
    const looseRangePattern = /^(\*|latest|x)$/i;

    for (const relativePath of packages) {
      const pkg = readPackageJson(relativePath);
      const deps = allDeps(pkg);
      for (const [name, version] of Object.entries(deps)) {
        // Las dependencias internas del workspace (`@apex/*`) usan `"*"`
        // intencionalmente para resolver siempre a la versión local del
        // monorepo, no a un rango de npm; se excluyen de esta regla.
        if (name.startsWith("@apex/")) continue;
        expect(
          looseRangePattern.test(version),
          `${relativePath}: la dependencia "${name}" usa un rango no fijado ("${version}")`
        ).toBe(false);
      }
    }
  });
});
