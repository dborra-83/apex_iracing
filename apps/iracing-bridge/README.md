# @apex/iracing-bridge

Reemplazo **drop-in** de `apps/generador-demo`: en vez de simular una sesión de carrera de forma procedural, lee datos **reales** de iRacing (vía memoria compartida de Windows) y los transmite por el mismo protocolo WebSocket que ya consumen `apps/dashboard` y `apps/apex-mobile`. Ninguna de las dos apps necesita cambios de código: solo hay que apuntarlas al puerto donde corre este proceso en vez de `apps/generador-demo` (nunca los dos a la vez sobre el mismo puerto).

## Requisitos

- **Windows.** El SDK nativo de iRacing (`@irsdk-node/native`) solo existe para Windows. Este paquete no funciona en macOS/Linux (`main.ts` lo detecta y sale con un mensaje claro en vez de fallar de forma confusa).
- **iRacing corriendo en la MISMA máquina** donde se ejecuta este proceso. El SDK lee memoria compartida local; no hay transporte de red, así que no se puede correr el bridge en una máquina distinta a la que tiene iRacing abierto.
- **Estar en una sesión activa** (práctica, qualy o carrera) para que haya telemetría que leer. Sin sesión activa, el bridge queda escuchando el puerto WebSocket pero no emite eventos hasta detectar una.

## Uso

```powershell
cd apps/iracing-bridge
npm run dev
```

Por defecto escucha en `ws://localhost:8080`, el mismo puerto/protocolo que `apps/generador-demo`. Se puede cambiar con la variable de entorno `PORT`.

## Qué NO está verificado

Este paquete fue escrito e integrado en un entorno **sin Windows y sin iRacing instalado**. Se verificó:

- Instalación real de `irsdk-node`/`@irsdk-node/native` en este monorepo (usa binarios prebuilt, no requiere compilar nada localmente en Windows tampoco).
- Compilación de tipos completa (`tsc --noEmit`) contra los tipos reales de `@irsdk-node/types@4.4.0`.
- Que los nombres de variable de telemetría usados (`Speed`, `RPM`, `LapDistPct`, `LFtempCM`, `CarIdxPosition`, etc.) existen realmente en el catálogo de tipos generado por esa versión del SDK.

**NO se verificó** (y no se puede verificar sin una máquina Windows con iRacing):

- Que el bridge efectivamente se conecta y recibe datos de una sesión real.
- Que los valores mapeados (velocidad, posición, neumáticos, banderas) sean correctos en la práctica, más allá de estar tipados y con las unidades documentadas.
- Que `getSessionInfo()`/`getDriverInfo()` devuelvan exactamente la forma asumida en `sdk/types.ts` (`RawSessionInfo`) para todas las versiones de iRacing — el YAML de SessionInfo no tiene un esquema formal público y puede variar entre builds del simulador.

Antes de depender de este bridge para uso real, correr `npm run dev` en la PC con iRacing, entrar a una sesión y comparar los valores mostrados en el Dashboard/Apex Mobile contra el HUD nativo de iRacing.

## Limitaciones conocidas del mapeo (por diseño, no bugs)

| Campo | Limitación | Por qué |
|---|---|---|
| `Evento_Track.path` | Es el mismo óvalo genérico que usa `apps/generador-demo`, solo escalado por la longitud real del circuito (`length_m`) | La SDK de iRacing no expone las coordenadas x/y reales de ningún circuito, ni en telemetría ni en SessionInfo. El `MiniMap` sigue funcionando (posición propia + rivales sobre `lap_dist_pct`, que sí es dato real), pero dibuja una silueta inventada, no la forma real del circuito. |
| `StandingsEntryV1_1.class_id` | Siempre `"class-0"` para todos los autos | La clase real de cada auto vive en `DriverInfo.Drivers[].CarClassID` (SessionInfo), no leído por este mapper para mantener la primera versión simple. Sesiones multi-clase no se distinguen. |
| `StandingsEntryV1_1.gap` | Aproximado con `CarIdxF2Time` | La SDK no expone un "gap al líder" acumulado por auto en telemetría estándar; `F2Time` es el tiempo estimado al auto inmediatamente delante, no al líder. |
| `StandingsEntryV1_1.last_sector_times` / `best_sector_times` | Siempre `[null]` (un solo sector, sin dato) para todos los rivales | La SDK no expone tiempos de sector por auto rival en telemetría estándar, solo del piloto local vía `SplitTimeInfo`. Los paneles que dependen de esto (Comparativa_Sectores, parciales) muestran su estado "no disponible" ya existente. |
| `StandingsEntryV1_1.fuel_level` | Siempre `0` para rivales | La SDK no expone nivel de combustible de otros autos, solo del piloto local. |
| `TelemetryEventV1.delta_to_prev` | Aproximado con `LapDeltaToOptimalLap` (delta al mejor tiempo combinando sectores, no a la vuelta anterior real) | La SDK no expone un delta a la vuelta anterior de forma directa; es la única otra señal de delta en vivo disponible. |
| `TireCornerV1.pressure` | Es la presión EN FRÍO fijada en el garage (`*coldPressure`), no la presión dinámica en caliente | La SDK no expone presión en caliente en vivo por rueda en telemetría estándar (solo en el flujo de servicio de pits). |
| `TireCornerV1.temp`/`.wear` | Se usa solo la lectura del centro de la banda (`*tempCM`/`*wearM`), ignorando los bordes izquierdo/derecho (`*CL`/`*CR`, `*wearL`/`*wearR`) | `TireCornerV1` modela un único valor por rueda (mismo criterio que ya usa `apps/generador-demo`), no 3 zonas por rueda. |
| `SessionEventV1.session_type` | Siempre `"race"` | La SDK expone el tipo de sesión real en `SessionInfo.SessionInfo.Sessions[].SessionType`, no leído por este mapper en su primera versión. |
| `TelemetryEventV1.driver_id` | Siempre `"player"` | La telemetría "plana" (sin prefijo `CarIdx`) siempre corresponde al piloto local; no hay un ID de piloto real disponible ahí (solo en `DriverInfo`, no correlacionado con el `driver_id` usado en standings). |

Ninguna de estas limitaciones rompe la app: los paneles que dependen de datos no disponibles ya tienen su camino de degradación explícita implementado (mostrar "no disponible" en vez de asumir un valor por defecto silencioso), heredado de la especificación `apex-mobile-and-dashboard-expansion`.

## Extender este bridge

Si se necesita resolver alguna de las limitaciones de arriba:
- **Multi-clase real**: leer `DriverInfo.Drivers[].CarClassID` en `sdk/iracingClient.ts` y pasarlo a `mapping/standings.ts`.
- **Tipo de sesión real**: leer `SessionInfo.SessionInfo.Sessions[CurrentSessionNum].SessionType` en `mapping/session.ts`.
- **Mapa real del circuito**: requeriría un catálogo de coordenadas por circuito (no expuesto por la SDK) o acumular la posición GPS del piloto local a lo largo de una vuelta de referencia para reconstruir la silueta — ninguna de las dos está implementada aquí.
