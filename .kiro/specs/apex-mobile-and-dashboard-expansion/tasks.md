# Implementation Plan: apex-mobile-and-dashboard-expansion

## Overview

Convierte el diseño de la ampliación en pasos de codificación incrementales. El orden sigue las capas del diseño: primero se extrae la lógica pura ya existente de `apps/dashboard` hacia los nuevos paquetes compartidos (`packages/telemetry-core`, `packages/ws-client-core`) sin alterar su comportamiento; después se amplía el Contrato_Datos a la Version_Contrato_1_1 y el motor de simulación del Generador_Demo; luego se implementan los nuevos cálculos puros compartidos (gaps, comparativa de sectores, stint multi-piloto, rivales cercanos); después se amplían los paneles ya existentes del Dashboard; y finalmente se construye `apps/apex-mobile` desde cero reutilizando todo lo anterior. Los tests de propiedades (fast-check) se ubican justo después de la función pura que validan.

## Tasks

- [x] 1. Extraer lógica pura compartida a `packages/telemetry-core` y `packages/ws-client-core`
  - [x] 1.1 Crear `packages/telemetry-core` (`package.json`, `tsconfig.json`) y mover `lapPctToPoint`/`getSectorForLapPct` (de `apps/dashboard/lib/view-models/track.ts`) y `estimateRemainingLaps`/`deriveFuelConsumptionRate` (de `apps/dashboard/lib/view-models/fuel.ts`) sin alterar su comportamiento ni firma
    - _Requirements: 12.1_
  - [x] 1.2 Actualizar `apps/dashboard` para importar dichas funciones desde `@apex/telemetry-core` en vez de sus copias locales, eliminando los archivos originales movidos
    - _Requirements: 12.2_
  - [x] 1.3 Crear `packages/ws-client-core` (`package.json`, `tsconfig.json`) y mover `createWsClient`/`handleRawMessage` (de `apps/dashboard/lib/ws-client`) sin alterar su comportamiento
    - _Requirements: 12.4_
  - [x] 1.4 Actualizar `apps/dashboard` para importar `createWsClient` desde `@apex/ws-client-core`
    - _Requirements: 12.4_
  - [x]* 1.5 Ejecutar la suite de tests existente de `apps/dashboard` (movidos junto con las funciones extraídas) contra los paquetes nuevos, verificando que ningún test cambia de resultado tras la extracción

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Ampliar el Contrato_Datos a la Version_Contrato_1_1 (`packages/contrato-datos`)
  - [x] 3.1 Actualizar `SUPPORTED_CONTRACT_VERSIONS` en `envelope.ts` para incluir simultáneamente `"1.0.0"` y `"1.1.0"`
    - _Requirements: 1.3_
  - [x] 3.2 Implementar `StandingsEntryV1_1Schema`/`StandingsEventV1_1Schema` en un nuevo módulo `v1_1/standings.ts`, extendiendo `StandingsEntryV1Schema` con `lap_dist_pct`, `fuel_level`, `last_sector_times` y `best_sector_times`
    - _Requirements: 1.1, 1.7_
  - [x]* 3.3 Escribir property test para `StandingsEntryV1_1Schema`
    - **Property 1: El Evento_Standings v1.1.0 es una extensión conforme del v1.0.0**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 3.4 Actualizar `eventoV1.ts`/la unión discriminada para aceptar tanto `StandingsEventV1Schema` como `StandingsEventV1_1Schema` bajo el mismo campo `type: "standings"`, distinguidos por `version_contrato`
    - _Requirements: 1.2_
  - [x] 3.5 Actualizar `parseEvent` para despachar el payload de `standings` al esquema Zod correspondiente exacto según `version_contrato` (`"1.0.0"` → esquema original, `"1.1.0"` → esquema ampliado), preservando la clasificación `unsupported_version` para cualquier otro valor antes de intentar `safeParse`
    - _Requirements: 1.4, 1.5, 1.6_
  - [x]* 3.6 Escribir property test para `parseEvent` ampliado
    - **Property 11: parseEvent despacha standings al esquema correcto según version_contrato**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Ampliar el motor de simulación del Generador_Demo con datos por-piloto
  - [x] 5.1 Ampliar `DriverState` (`state.ts`) con `currentSectorIndex`, `currentSectorStartLapTime`, `lastSectorTimes` y `bestSectorTimes`, inicializando ambos arrays de tiempos con valores nulos de longitud igual a `sectors.length` en `createDriverState`
    - _Requirements: 2.5_
  - [x] 5.2 Implementar `recordSectorCompletion`, reutilizando `getSectorForLapPct` de `@apex/telemetry-core` para detectar la transición de sector y registrar el tiempo del sector completado en `lastSectorTimes`, actualizando `bestSectorTimes` cuando corresponda
    - _Requirements: 2.3, 2.4_
  - [x]* 5.3 Escribir property test para `recordSectorCompletion`
    - **Property 2: Longitud fija y consistente de sector_times**
    - **Property 3: best_sector_times es siempre el mínimo histórico por sector**
    - **Validates: Requirements 1.7, 2.3, 2.4, 2.5**
  - [x] 5.4 Integrar `recordSectorCompletion` en el pipeline de `SimulationEngine.tick`, después de `advanceLap` y antes de `recomputePositions`
    - _Requirements: 2.3_
  - [x] 5.5 Actualizar `buildStandingsEvent` para poblar `lap_dist_pct`, `fuel_level`, `last_sector_times` y `best_sector_times` de cada piloto, y para emitir `version_contrato: "1.1.0"`
    - _Requirements: 2.1, 2.2_
  - [x] 5.6 Actualizar `buildTelemetryEvent`, `buildSessionEvent` y `buildTrackEvent` para emitir `version_contrato: "1.1.0"`, sin cambios en el resto de su estructura
    - _Requirements: 2.1_
  - [x]* 5.7 Escribir property test actualizado para las funciones `build*Event`
    - **Property 1: El Evento_Standings v1.1.0 es una extensión conforme del v1.0.0** (aplicada ahora contra `buildStandingsEvent`)
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar los cálculos puros compartidos de `packages/telemetry-core`
  - [x] 7.1 Implementar `computeGaps` (`gaps.ts`): cálculo de `gapAhead`/`gapBehind` a partir de `position` y `gap` ordenando por posición ascendente
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x]* 7.2 Escribir property test para `computeGaps`
    - **Property 4: computeGaps produce una biyección simétrica y no negativa**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  - [x] 7.3 Implementar `compareSectorTimes` (`sectors.ts`): comparación índice a índice de dos arrays de tiempos de sector, preservando `null` y lanzando error ante longitudes distintas
    - _Requirements: 4.2, 4.3_
  - [x]* 7.4 Escribir property test para `compareSectorTimes`
    - **Property 5: compareSectorTimes preserva null y calcula delta exacto**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  - [x] 7.5 Implementar `estimateStintForAllDrivers` (`fuel-multi.ts`), reutilizando `estimateRemainingLaps`/`deriveFuelConsumptionRate` ya movidos en la tarea 1.1, y derivando `estimatedPitInLapsFromNow`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x]* 7.6 Escribir property test para `estimateStintForAllDrivers`
    - **Property 6: estimateStintForAllDrivers generaliza estimateRemainingLaps sin alterar su contrato**
    - **Property 7: estimatedPitInLapsFromNow es consistente con estimatedRemainingLaps**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  - [x] 7.7 Implementar `circularDistance` y `nearestRivals` (`track.ts`), excluyendo siempre al piloto observado y ordenando por proximidad circular de `lap_dist_pct`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x]* 7.8 Escribir property test para `nearestRivals`
    - **Property 8: nearestRivals nunca incluye al piloto observado y respeta el top-k por distancia circular**
    - **Validates: Requirements 10.1, 10.2, 10.4**
  - [x]* 7.9 Escribir property test para `circularDistance`
    - **Property 9: La distancia circular es simétrica y máxima en 0.5**
    - **Validates: Requirements 10.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Ampliar `Panel_Clasificacion` con Gap_Adelante/Gap_Atras
  - [x] 9.1 Integrar `computeGaps` de `@apex/telemetry-core` en `PanelClasificacion.tsx`, agregando columnas de Gap_Adelante y Gap_Atras junto al gap al líder ya existente
    - _Requirements: 7.1, 7.2_
  - [ ]* 9.2 Escribir unit test de renderizado de `PanelClasificacion` con un `Evento_Standings_Ampliado` de ejemplo, verificando las nuevas columnas
    - _Requirements: 7.1_

- [x] 10. Ampliar `Panel_Telemetria` con Comparativa_Sectores
  - [x] 10.1 Implementar el selector de piloto rival y el sub-panel de comparativa de sectores en `PanelTelemetria.tsx`, invocando `compareSectorTimes` con `last_sector_times` del observado y del rival, sin alterar el trace de throttle/brake ya existente
    - _Requirements: 4.1, 4.2, 4.4_
  - [x] 10.2 Mostrar explícitamente como "sin diferencia calculable" los sectores donde `deltaSeconds` sea `null`
    - _Requirements: 4.3_
  - [ ]* 10.3 Escribir unit test de la Comparativa_Sectores seleccionando un rival concreto y verificando los deltas mostrados
    - _Requirements: 4.2, 4.3_

- [x] 11. Ampliar `Panel_Fuel` con Stint_Planning_Multi_Piloto
  - [x] 11.1 Implementar la tabla de stint planning multi-piloto en `PanelFuel.tsx`, invocando `estimateStintForAllDrivers` con el historial de combustible de cada piloto y mostrando combustible actual, vueltas restantes y vuelta estimada de pit
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 11.2 Mostrar explícitamente "no disponible" cuando `estimatedRemainingLaps` sea `Infinity`, y permitir ordenar la tabla por urgencia (menor `estimatedRemainingLaps` primero)
    - _Requirements: 5.4, 5.5_
  - [ ]* 11.3 Escribir unit test de renderizado de la tabla de stint multi-piloto con un conjunto de historiales de ejemplo
    - _Requirements: 5.1, 5.5_

- [x] 12. Ampliar `Panel_Mapa` con la posición de todos los pilotos
  - [x] 12.1 Dibujar sobre el trazado la posición de cada piloto del `Evento_Standings_Ampliado` (usando `lap_dist_pct` y `lapPctToPoint`), no solo la del piloto observado
    - _Requirements: 6.1, 6.2_
  - [ ]* 12.2 Escribir unit test de renderizado del `Panel_Mapa` con varios pilotos de ejemplo
    - _Requirements: 6.1_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Manejar la compatibilidad hacia atrás ante Evento_Standings sin los campos ampliados
  - [x] 14.1 Implementar, en los paneles que dependen de los campos nuevos (`Panel_Fuel` multi-piloto, `Panel_Telemetria` comparativa, `Panel_Mapa` multi-piloto), la detección explícita de un `Evento_Standings` sin dichos campos y la presentación de un estado "no disponible" en vez de un valor por defecto silencioso
    - _Requirements: 13.1_
  - [x] 14.2 Verificar que `Panel_Clasificacion` (Gap_Adelante/Gap_Atras) sigue funcionando con normalidad ante un `Evento_Standings` sin los campos ampliados, dado que `computeGaps` no depende de ellos
    - _Requirements: 13.2_
  - [ ]* 14.3 Escribir property test para la degradación explícita
    - **Property 10: Degradación explícita ante Evento_Standings v1.0.0 (sin campos nuevos)**
    - **Validates: Requirements 13.1, 13.2**

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Inicializar `apps/apex-mobile`
  - [x] 16.1 Inicializar `apps/apex-mobile` con Next.js, TypeScript y Tailwind CSS, añadiendo `@apex/contrato-datos`, `@apex/telemetry-core` y `@apex/ws-client-core` como dependencias del workspace
    - _Requirements: 8.2, 12.5_
  - [x] 16.2 Configurar el Service Worker + Web App Manifest de Apex Mobile en `next.config.ts`/`app/manifest.ts` (usando `@serwist/next` en vez de `next-pwa`: `next-pwa` requiere Webpack clásico y ya no se mantiene activamente; Serwist es su sucesor mantenido, con el mismo enfoque de precache vía Workbox. El Service Worker se deshabilita en desarrollo — Serwist aún no soporta Turbopack en `next dev`, ver `serwist/serwist#54` — y el build de producción se invoca con `next build --webpack` para que Turbopack no intercepte el `webpack()` que Serwist inyecta)
    - _Requirements: 8.2_
  - [x] 16.3 Configurar el theming de fondo oscuro, acentos cian/neón y tipografía condensada de Apex Mobile
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 17. Implementar la conexión y los stores de `apps/apex-mobile`
  - [x] 17.1 Instanciar `createWsClient` de `@apex/ws-client-core` apuntando al mismo servidor WebSocket del Generador_Demo ya usado por el Dashboard
    - _Requirements: 12.5_
  - [x] 17.2 Implementar los stores Zustand (`telemetry`/`standings`/`session`/`track`) y `dispatchEvent` de Apex Mobile, reutilizando el mismo patrón de narrowing exhaustivo ya usado en el Dashboard
    - _Requirements: 12.3_
  - [x] 17.3 Conservar el estado de los stores y la conexión WebSocket ante un cambio de orientación portrait/landscape (sin reiniciar la sesión)
    - _Requirements: 8.4_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Implementar los componentes de la Pantalla_Principal de Apex Mobile
  - [x] 19.1 Implementar `Speedometer` (velocímetro circular + shift lights derivados de `rpm`) y `GearIndicator`
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 19.2 Implementar `LapTimesPanel` (tiempo de vuelta actual, mejor vuelta, delta a vuelta anterior, delta a vuelta óptima)
    - _Requirements: 9.4_
  - [x] 19.3 Implementar `PositionGapPanel` (posición, Gap_Adelante y Gap_Atras) reutilizando `computeGaps` de `@apex/telemetry-core`
    - _Requirements: 9.5_
  - [x] 19.4 Implementar `FuelPanel` (combustible restante y vueltas estimadas) reutilizando `estimateRemainingLaps`/`deriveFuelConsumptionRate` de `@apex/telemetry-core`
    - _Requirements: 9.6_
  - [x] 19.5 Implementar `MiniMap` (trazado, posición propia y Rivales_Cercanos) reutilizando `lapPctToPoint` y `nearestRivals` de `@apex/telemetry-core`
    - _Requirements: 9.7, 10.1, 10.2, 10.3, 10.4_
  - [x] 19.6 Ensamblar `app/page.tsx` como única Pantalla_Principal montando todos los componentes simultáneamente, sin tabs ni router interno, con layout responsive portrait/landscape que muestra el mismo conjunto de datos en ambas orientaciones
    - _Requirements: 8.1, 8.3_
  - [ ]* 19.7 Escribir unit test de renderizado de `app/page.tsx` en modo portrait y en modo landscape, verificando que ambos muestran el mismo conjunto de campos de datos
    - _Requirements: 8.3_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Verificación final de portabilidad e integración
  - [ ]* 21.1 Escribir integration test levantando el servidor WebSocket real emitiendo `version_contrato: "1.1.0"`, conectando un cliente de prueba equivalente al del Dashboard y otro equivalente al de Apex Mobile, y verificando que ambos parsean el mismo mensaje de standings de forma idéntica
    - **Property 12: Idéntico resultado de dispatchEvent en ambas apps (portabilidad)**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**
  - [ ]* 21.2 Escribir integration test de regresión de compatibilidad: un cliente de prueba configurado con `SUPPORTED_CONTRACT_VERSIONS = ["1.0.0"]` descarta los mensajes `"1.1.0"` sin lanzar excepción
    - _Requirements: 1.6_
  - [ ]* 21.3 Escribir smoke test que verifique las dependencias declaradas en los `package.json` nuevos/actualizados (`packages/telemetry-core`, `packages/ws-client-core`, `apps/apex-mobile` con `@serwist/next`) y que el build completo del monorepo se completa sin errores
    - _Requirements: 8.2, 12.1, 12.4_

- [x] 22. Checkpoint final - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido; las tareas de implementación principal nunca están marcadas como opcionales.
- Cada property test referencia el número de propiedad y la sección "Validates" tal como aparecen en `design.md`.
- Los checkpoints validan que la suite de tests completa (unit + property + integration + smoke) pasa antes de avanzar a la siguiente capa.
- La extracción de código a `packages/telemetry-core`/`packages/ws-client-core` (tarea 1) se hace ANTES de tocar el Contrato_Datos o el Generador_Demo, para que las funciones movidas puedan reutilizarse tanto en la ampliación del motor de simulación (`recordSectorCompletion` usa `getSectorForLapPct`) como en los nuevos cálculos compartidos.
- Los requisitos no testeables automáticamente según `design.md` (estética visual de Apex Mobile, legibilidad a distancia) quedan cubiertos por las tareas de implementación correspondientes y se validan por revisión manual.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "3.1"] },
    { "id": 3, "tasks": ["1.5", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4"] },
    { "id": 5, "tasks": ["3.5"] },
    { "id": 6, "tasks": ["3.6", "5.1"] },
    { "id": 7, "tasks": ["5.2", "7.1", "7.3", "7.7"] },
    { "id": 8, "tasks": ["5.3", "5.4", "7.2", "7.4", "7.8", "7.9"] },
    { "id": 9, "tasks": ["5.5", "7.5"] },
    { "id": 10, "tasks": ["5.6", "7.6"] },
    { "id": 11, "tasks": ["5.7"] },
    { "id": 12, "tasks": ["9.1", "10.1", "11.1", "12.1", "16.1"] },
    { "id": 13, "tasks": ["9.2", "10.2", "11.2", "12.2", "16.2", "16.3"] },
    { "id": 14, "tasks": ["10.3", "11.3", "14.1", "14.2", "17.1"] },
    { "id": 15, "tasks": ["14.3", "17.2"] },
    { "id": 16, "tasks": ["17.3", "19.1", "19.2", "19.3", "19.4", "19.5"] },
    { "id": 17, "tasks": ["19.6"] },
    { "id": 18, "tasks": ["19.7", "21.1", "21.2", "21.3"] }
  ]
}
```
