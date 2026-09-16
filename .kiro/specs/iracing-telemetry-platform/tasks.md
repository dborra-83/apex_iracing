# Implementation Plan: iracing-telemetry-platform

## Overview

Convierte el diseño del monorepo TypeScript (`packages/contrato-datos`, `apps/generador-demo`, `apps/dashboard`) en pasos de codificación incrementales. El orden sigue las capas del diseño: primero el Contrato_Datos (única fuente de verdad de tipos/esquemas Zod versionados), después el motor de simulación puro y el servidor WebSocket del Generador_Demo, y finalmente el cliente WebSocket, los stores Zustand, los view-models puros y los 5 paneles del Dashboard. Los tests de propiedades (fast-check) se ubican justo después de la función pura que validan, y los tests de integración/smoke se ubican junto a la infraestructura correspondiente (servidor WebSocket, arranque del proceso, stack tecnológico).

## Tasks

- [x] 1. Configurar el monorepo TypeScript
  - [x] 1.1 Crear estructura de carpetas y `package.json` raíz con workspaces (npm/pnpm) para `packages/contrato-datos`, `apps/generador-demo` y `apps/dashboard`
    - _Requirements: 5.1_
  - [x] 1.2 Configurar `tsconfig.base.json` y las herramientas de testing compartidas (test runner y `fast-check`) en el monorepo
    - _Requirements: 5.1_

- [x] 2. Implementar el Contrato_Datos (`packages/contrato-datos`)
  - [x] 2.1 Implementar el envelope base y utilidades de versión (`BaseEnvelopeSchema`, `SUPPORTED_CONTRACT_VERSIONS`, `isSupportedVersion`)
    - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.1, 5.3, 5.4_
  - [x] 2.2 Implementar el esquema Zod del Evento_Telemetry (`telemetry.ts`) con todos sus campos y tipos numéricos
    - _Requirements: 1.1, 1.4, 5.2_
  - [x] 2.3 Implementar el esquema Zod del Evento_Standings (`standings.ts`) con la lista de pilotos y sus campos
    - _Requirements: 2.1, 5.2_
  - [x] 2.4 Implementar el esquema Zod del Evento_Session (`session.ts`) con tipo de sesión, clima, bandera, tiempo/vueltas restantes e incidentes
    - _Requirements: 3.1, 5.2_
  - [x] 2.5 Implementar el esquema Zod del Evento_Track (`track.ts`) con nombre, longitud, `path` y `sectors`
    - _Requirements: 4.1, 5.2_
  - [x] 2.6 Implementar la unión discriminada `EventoV1Schema` y la función `parseEvent(raw): Result<EventoV1, ContractError>` que comprueba `isSupportedVersion` antes de interpretar el resto del payload
    - _Requirements: 5.2, 5.4_
  - [x]* 2.7 Escribir property test para `parseEvent`
    - **Property 2: Filtrado correcto por version_contrato**
    - **Validates: Requirements 5.4, 14.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar el motor de simulación procedural (`apps/generador-demo/src/simulation`)
  - [x] 4.1 Implementar el PRNG con semilla explícita (`createRng`, tipo `mulberry32`/`xorshift32`)
    - _Requirements: 6.1_
  - [x] 4.2 Implementar la creación del estado inicial de sesión y de pilotos (`createInitialState`, `createDriverState`) con al menos dos clases simultáneas
    - _Requirements: 6.1, 6.7_
  - [x] 4.3 Implementar el avance de vuelta (`advanceLap`) y la actualización de `lap_dist_pct`
    - _Requirements: 6.2_
  - [x]* 4.4 Escribir property test para `advanceLap`
    - **Property 6: Avance continuo y acotado de lap_dist_pct**
    - **Validates: Requirements 6.2, 1.1**
  - [x] 4.5 Implementar el consumo de combustible (`applyFuelConsumption`) con piso en 0
    - _Requirements: 6.5_
  - [x]* 4.6 Escribir property test para `applyFuelConsumption`
    - **Property 7: Combustible no negativo y monótonamente no creciente sin pit stop**
    - **Validates: Requirements 6.5**
  - [x] 4.7 Implementar las paradas en pits (`maybeTriggerPitStop`) para al menos un piloto durante la sesión
    - _Requirements: 6.4_
  - [x] 4.8 Implementar la variación de condiciones climáticas (`advanceWeather`)
    - _Requirements: 6.6_
  - [x] 4.9 Implementar el recómputo de posiciones (`recomputePositions`) y los cambios de posición entre pilotos
    - _Requirements: 6.3_
  - [x]* 4.10 Escribir property test para `recomputePositions`
    - **Property 8: Unicidad y rango de posiciones en Evento_Standings**
    - **Validates: Requirements 2.1**
  - [x] 4.11 Implementar las funciones de construcción de eventos (`buildTelemetryEvent`, `buildStandingsEvent`, `buildSessionEvent`, `buildTrackEvent`) usando los esquemas de `@apex/contrato-datos`
    - _Requirements: 6.8_
  - [x]* 4.12 Escribir property test para las funciones `build*Event`
    - **Property 1: Conformidad de todo evento con el Contrato_Datos**
    - **Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.2, 6.8**
  - [x] 4.13 Implementar la detección de cambios en el estado global de la sesión (`hasSessionStateChanged`) y la emisión condicional de Evento_Session
    - _Requirements: 3.3_
  - [x]* 4.14 Escribir property test para `hasSessionStateChanged`
    - **Property 3: Emisión de Evento_Session ante cualquier cambio de estado global**
    - **Validates: Requirements 3.3**
  - [x] 4.15 Implementar `SimulationEngine` (constructor con validación fail-fast de la configuración, `tick(dtMs)` orquestando todas las funciones puras, `buildTrackEvent` con emisión única por sesión)
    - _Requirements: 4.3, 6.1, 6.2_
  - [ ]* 4.16 Escribir property test para `SimulationEngine`
    - **Property 4: Exactamente un Evento_Track por sesión**
    - **Validates: Requirements 4.3**
  - [ ]* 4.17 Escribir property test para `SimulationEngine`
    - **Property 5: Determinismo por semilla del motor de simulación**
    - **Validates: Requirements 6.1**
  - [ ]* 4.18 Escribir unit tests de una sesión simulada completa con semilla fija: al menos un cambio de posición, al menos una parada en pits, al menos un cambio de condición climática y pilotos de al menos 2 clases
    - _Requirements: 6.3, 6.4, 6.6, 6.7_
  - [ ]* 4.19 Escribir unit test de validación de configuración inválida (`driverCount <= 0`) verificando el error descriptivo fail-fast del constructor de `SimulationEngine`

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar el servidor WebSocket y el proceso del Generador_Demo (`apps/generador-demo/src/server`)
  - [x] 6.1 Implementar `startServer` con `ws`: envío del Evento_Track al conectar y broadcast del loop de `tick` (~16.6ms) a todos los sockets activos sin depender de conexiones particulares
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 6.2 Implementar `main.ts`: arranque de `SimulationEngine` y del servidor WebSocket con semilla y puerto configurables
    - _Requirements: 7.4_
  - [ ]* 6.3 Escribir integration test del servidor WebSocket real (puerto efímero): conectar un cliente de prueba, verificar la recepción del Evento_Track inicial, y verificar que el motor sigue avanzando tras cerrar el socket
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 6.4 Escribir integration test de frecuencias: medir el intervalo medio entre Evento_Telemetry y Evento_Standings emitidos durante una ejecución corta y verificar que caen dentro de la tolerancia de ~60Hz y 1-5Hz respectivamente
    - _Requirements: 1.3, 2.3_
  - [ ]* 6.5 Escribir smoke test de arranque del proceso: el Generador_Demo escucha en el puerto configurado usando solo Node.js + `ws`, sin dependencias nativas adicionales
    - _Requirements: 7.4_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Configurar la aplicación Dashboard (`apps/dashboard`)
  - [x] 8.1 Inicializar `apps/dashboard` con Next.js App Router, TypeScript, Tailwind CSS y componentes shadcn/ui, añadiendo `@apex/contrato-datos` como dependencia del workspace
    - _Requirements: 8.3, 17.1, 17.2_
  - [x] 8.2 Configurar el theming oscuro neón sobre shadcn/ui y la tipografía condensada tipo racing HUD (clase utilitaria `.hud-number`)
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 9. Implementar el cliente WebSocket con reconexión (`apps/dashboard/lib/ws-client`)
  - [x] 9.1 Implementar `createWsClient`: conexión al `WebSocket` nativo, parseo de mensajes entrantes y reconexión automática con backoff exponencial acotado tras `onclose`
    - _Requirements: 14.1, 14.3, 17.5_
  - [x] 9.2 Implementar `handleRawMessage` usando `isSupportedVersion` y `parseEvent` de `@apex/contrato-datos`, descartando silenciosamente (con log de advertencia) los mensajes no parseables o con versión incompatible
    - _Requirements: 5.4, 14.2, 14.4_
  - [ ]* 9.3 Escribir unit tests del cliente WebSocket con un mock de `WebSocket` global: verificar reintento de conexión tras `onclose` con backoff, y descarte de JSON inválido
    - _Requirements: 14.1, 14.3_

- [x] 10. Implementar los stores Zustand y el enrutamiento de eventos (`apps/dashboard/lib/store`)
  - [x] 10.1 Implementar los stores `useTelemetryStore`, `useStandingsStore`, `useSessionStore` y `useTrackStore`, cada uno con su acción para fijar el último evento válido recibido
    - _Requirements: 17.6_
  - [x] 10.2 Implementar `dispatchEvent(e: EventoV1)` con narrowing exhaustivo sobre `e.type`, delegando exactamente al store correspondiente
    - _Requirements: 14.2_
  - [ ]* 10.3 Escribir property test para `dispatchEvent`
    - **Property 15: El enrutamiento de mensajes dirige cada evento exactamente a su handler por tipo**
    - **Validates: Requirements 14.2**
  - [ ]* 10.4 Escribir property test para los reducers de los stores
    - **Property 14: El estado derivado del store siempre refleja el último evento recibido por tipo**
    - **Validates: Requirements 10.3, 12.3, 13.3**
  - [x] 10.5 Implementar el batching de Evento_Telemetry vía `requestAnimationFrame`, acumulando mensajes en un buffer y actualizando `useTelemetryStore` una sola vez por frame
    - _Requirements: 15.1, 15.2_
  - [x] 10.6 Conectar `createWsClient` → `handleRawMessage` → `dispatchEvent` en la inicialización de la aplicación del Dashboard
    - _Requirements: 14.1, 14.2_
  - [ ]* 10.7 Escribir integration test con un mock del `WebSocket` global: verificar que el Dashboard establece la conexión automáticamente al montar la app y que reintenta tras un `onclose`
    - _Requirements: 14.1, 14.3_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implementar los view-models puros de los paneles (`apps/dashboard/lib/view-models`)
  - [x] 12.1 Implementar `lapPctToPoint` y `getSectorForLapPct` (proyección geométrica de `lap_dist_pct` sobre el `path` y los `sectors` del Evento_Track)
    - _Requirements: 9.2, 9.3_
  - [ ]* 12.2 Escribir property test para `lapPctToPoint` y `getSectorForLapPct`
    - **Property 9: Mapeo geométrico consistente de progreso de vuelta**
    - **Validates: Requirements 9.2, 9.3**
  - [x] 12.3 Implementar el view-model de clasificación (agrupamiento contiguo por clase, preservando todos los valores del Evento_Standings)
    - _Requirements: 10.1, 10.2_
  - [ ]* 12.4 Escribir property test para el view-model de clasificación
    - **Property 10: El view-model de clasificación preserva los datos y agrupa por clase**
    - **Validates: Requirements 10.1, 10.2**
  - [x] 12.5 Implementar la construcción de la serie de telemetría del Panel_Telemetria (orden, longitud y delta de sector) a partir de una secuencia de Evento_Telemetry
    - _Requirements: 11.1, 11.2_
  - [ ]* 12.6 Escribir property test para la construcción de la serie de telemetría
    - **Property 11: La serie de telemetría preserva orden, longitud y fidelidad del delta**
    - **Validates: Requirements 11.1, 11.2**
  - [x] 12.7 Implementar la selección y persistencia de la Vuelta_Referencia en el estado del Panel_Telemetria
    - _Requirements: 11.3, 11.4_
  - [ ]* 12.8 Escribir property test para la persistencia de la Vuelta_Referencia
    - **Property 12: La Vuelta_Referencia seleccionada es invariante ante nuevas telemetrías**
    - **Validates: Requirements 11.4**
  - [x] 12.9 Implementar `estimateRemainingLaps` (total y no negativa, devolviendo `Infinity` explícito cuando el consumo por vuelta es 0)
    - _Requirements: 13.2_
  - [ ]* 12.10 Escribir property test para `estimateRemainingLaps`
    - **Property 13: La estimación de vueltas restantes de combustible es total y no negativa**
    - **Validates: Requirements 13.2**

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implementar el layout modular por tabs del Dashboard
  - [x] 14.1 Implementar el layout raíz (`app/`) con `Tabs` de shadcn/ui para los 5 paneles, cargando cada `TabsContent` de forma perezosa (`dynamic import`)
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 15. Implementar el Panel_Mapa
  - [x] 15.1 Implementar el renderizado del trazado a partir del Evento_Track y la posición de cada piloto por sector, distinguiendo visualmente el sector actual
    - _Requirements: 9.1_
  - [ ]* 15.2 Escribir unit test de renderizado del Panel_Mapa con un estado fijo de ejemplo
    - _Requirements: 9.1_

- [x] 16. Implementar el Panel_Clasificacion
  - [x] 16.1 Implementar la tabla de clasificación multi-clase (`Table` de shadcn/ui) con Framer Motion para animar el reordenamiento de filas al recibir un nuevo Evento_Standings
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 16.2 Escribir unit test de renderizado del Panel_Clasificacion con un estado fijo de ejemplo
    - _Requirements: 8.2, 10.1_

- [x] 17. Implementar el Panel_Telemetria
  - [x] 17.1 Implementar el gráfico de throttle/brake con dibujo imperativo en `<canvas>` vía `requestAnimationFrame`, usando el buffer circular en `useRef` sin re-renderizar el árbol de React a 60Hz
    - _Requirements: 11.1, 15.1, 15.2, 17.4_
  - [x] 17.2 Implementar el overlay de la Vuelta_Referencia sobre el trace actual y la visualización del delta de sector
    - _Requirements: 11.2, 11.3, 11.4_
  - [ ]* 17.3 Escribir unit test seleccionando una Vuelta_Referencia concreta y verificando la superposición de su trace
    - _Requirements: 11.3_

- [x] 18. Implementar el Panel_Clima
  - [x] 18.1 Implementar las tarjetas de temperatura de pista, temperatura ambiente y condición climática actual
    - _Requirements: 12.1, 12.2_
  - [ ]* 18.2 Escribir unit test de renderizado del Panel_Clima con un estado fijo de ejemplo
    - _Requirements: 12.1, 12.2_

- [x] 19. Implementar el Panel_Fuel
  - [x] 19.1 Implementar la visualización del nivel de combustible actual y de la estimación de vueltas restantes
    - _Requirements: 13.1, 13.2_
  - [ ]* 19.2 Escribir unit test de renderizado del Panel_Fuel con un estado fijo de ejemplo
    - _Requirements: 13.1_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Verificación final del stack tecnológico
  - [ ]* 21.1 Escribir smoke test que verifique las dependencias declaradas en cada `package.json` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, librería de gráficos D3/Recharts/visx, `ws`/socket.io, Zustand/Jotai) y que el build del monorepo se completa sin errores
    - _Requirements: 8.1, 8.3, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 22. Checkpoint final - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido; las tareas de implementación principal nunca están marcadas como opcionales.
- Cada property test referencia el número de propiedad y la sección "Validates" tal como aparecen en `design.md`.
- Los checkpoints validan que la suite de tests completa (unit + property + integration + smoke) pasa antes de avanzar a la siguiente capa del monorepo.
- Los requisitos no testeables automáticamente según `design.md` (5.1, 5.3, 7.4 como aspecto arquitectónico, 8.1 como aspecto de organización, 15.1/15.2 de percepción de fluidez, 16.1-16.3 de estética subjetiva) quedan cubiertos por las tareas de implementación correspondientes y se validan por revisión manual, no por una tarea de test independiente.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2"] },
    { "id": 4, "tasks": ["2.6", "4.3", "4.5", "4.7", "4.8"] },
    { "id": 5, "tasks": ["2.7", "4.4", "4.6", "4.9", "8.1"] },
    { "id": 6, "tasks": ["4.10", "4.11", "8.2", "9.1", "12.1", "12.3", "12.5", "12.7", "12.9"] },
    { "id": 7, "tasks": ["4.12", "4.13", "9.2", "10.1", "12.2", "12.4", "12.6", "12.8", "12.10"] },
    { "id": 8, "tasks": ["4.14", "4.15", "9.3", "10.2", "14.1"] },
    { "id": 9, "tasks": ["4.16", "4.17", "4.18", "4.19", "6.1", "10.3", "10.4", "10.5"] },
    { "id": 10, "tasks": ["6.2", "10.6", "15.1", "16.1", "17.1", "18.1", "19.1"] },
    { "id": 11, "tasks": ["6.3", "6.4", "6.5", "10.7", "15.2", "16.2", "17.2", "18.2", "19.2"] },
    { "id": 12, "tasks": ["17.3"] },
    { "id": 13, "tasks": ["21.1"] }
  ]
}
```
