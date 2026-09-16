# Apex iRacing

Plataforma de telemetría de iRacing: un **Dashboard** de escritorio y una **PWA móvil (Apex Mobile)** que muestran datos de sesión en vivo (velocidad, vueltas, clasificación, combustible, neumáticos, volante, mapa, clima), alimentados por WebSocket desde:

- **Generador_Demo**: datos 100% sintéticos, para desarrollar/probar sin tener iRacing abierto.
- **iRacing_Bridge**: datos reales, leídos de iRacing mientras corre en la misma PC (solo Windows).

Ambas fuentes emiten el mismo protocolo, así que el Dashboard y Apex Mobile no cambian según cuál esté corriendo.

## Estructura del monorepo

```
apps/
  dashboard/         Next.js — panel de escritorio
  apex-mobile/        Next.js (PWA) — panel para celular
  generador-demo/     Servidor WebSocket con datos sintéticos
  iracing-bridge/     Servidor WebSocket con datos reales de iRacing (Windows only)
packages/
  contrato-datos/      Esquemas Zod versionados de los eventos (telemetry/standings/session/track)
  telemetry-core/      Funciones puras compartidas (gaps, sectores, fuel, status colors)
  ws-client-core/       Cliente WebSocket compartido por las dos apps Next.js
start-demo.bat         Lanza todo en modo demo (Windows)
start-real.bat          Lanza todo en modo real con iRacing (Windows)
```

## Requisitos previos

- **Node.js 20 o superior** (probado con Node 24). Verificar con `node --version`.
- **npm** (viene con Node).
- Para el modo **real** con iRacing: **Windows** + **iRacing instalado y corriendo** en la misma máquina donde se ejecuta el bridge.
- Git (para clonar el repositorio).

## 1. Clonar e instalar

```bash
git clone https://github.com/dborra-83/apex_iracing.git
cd apex_iracing
npm install
```

Es un monorepo con **npm workspaces**: un único `npm install` en la raíz instala las dependencias de todas las apps y paquetes.

## 2. Verificar que todo compila (opcional pero recomendado)

```bash
npm test
```

Debería correr la suite completa (vitest) sin errores.

## 3. Ejecutar en modo DEMO (datos sintéticos, sin iRacing)

Es el modo recomendado para desarrollar, probar la UI, o mostrar la app sin tener una sesión de iRacing activa.

### Windows (un solo doble clic)

Ejecutar `start-demo.bat` desde la raíz del repo. Abre 3 ventanas de terminal:

| Proceso | URL |
|---|---|
| Generador_Demo (WebSocket) | `ws://localhost:8080` |
| Dashboard | http://localhost:3000 |
| Apex Mobile | http://localhost:3001 |

### macOS / Linux / manual (3 terminales separadas)

```bash
# Terminal 1
cd apps/generador-demo
npm run dev

# Terminal 2
cd apps/dashboard
npm run dev -- -p 3000

# Terminal 3
cd apps/apex-mobile
npm run dev -- -p 3001
```

Luego abrir http://localhost:3000 (Dashboard) y http://localhost:3001 (Apex Mobile, ideal desde el celular en la misma red usando la IP local de la PC en vez de `localhost`).

## 4. Ejecutar en modo REAL (datos de iRacing en vivo)

**Solo funciona en Windows**, y el proceso debe correr en la **misma PC donde está instalado y abierto iRacing** (lee memoria compartida local, no hay transporte de red).

Requisitos antes de arrancar:
1. Tener iRacing instalado y abierto.
2. Estar en una sesión activa (práctica, qualy o carrera) — sin sesión activa el bridge queda esperando datos.

### Windows (un solo doble clic)

Ejecutar `start-real.bat` desde la raíz del repo. Abre 3 ventanas:

| Proceso | URL |
|---|---|
| iRacing_Bridge (WebSocket, datos reales) | `ws://localhost:8080` |
| Dashboard | http://localhost:3000 |
| Apex Mobile | http://localhost:3001 |

### Manual

```bash
# Terminal 1 — requiere Windows + iRacing corriendo
cd apps/iracing-bridge
npm run dev

# Terminal 2
cd apps/dashboard
npm run dev -- -p 3000

# Terminal 3
cd apps/apex-mobile
npm run dev -- -p 3001
```

**Importante:** nunca correr `generador-demo` e `iracing-bridge` al mismo tiempo — ambos intentan escuchar el mismo puerto (`8080` por defecto). Usar uno u otro según el modo deseado.

Antes de confiar en los datos del modo real, comparar los valores mostrados contra el HUD nativo de iRacing — ver limitaciones conocidas del mapeo en [`apps/iracing-bridge/README.md`](apps/iracing-bridge/README.md) (por ejemplo: el mapa del circuito es una silueta genérica, no la forma real, ya que la SDK de iRacing no expone coordenadas del trazado).

## 5. Usar Apex Mobile desde un celular

Para abrir Apex Mobile desde el teléfono en vez de la misma PC:

1. Confirmar que la PC y el celular están en la **misma red Wi-Fi**.
2. Obtener la IP local de la PC (Windows: `ipconfig`, buscar "Dirección IPv4").
3. En el navegador del celular, ir a `http://<IP-DE-LA-PC>:3001`.

Si no conecta, revisar que el firewall de Windows no esté bloqueando el puerto 3001 (y 8080, usado internamente por el navegador del celular para conectar al WebSocket).

## 6. Compilar para producción

```bash
# Dashboard
cd apps/dashboard
npm run build
npm run start

# Apex Mobile (usa webpack explícitamente, ver nota abajo)
cd apps/apex-mobile
npm run build
npm run start
```

> Apex Mobile usa `next build --webpack` en vez de Turbopack porque el plugin PWA (`@serwist/next`) todavía no soporta Turbopack en el paso de build.

## 7. Variables de entorno útiles

| Variable | Dónde | Default | Qué hace |
|---|---|---|---|
| `PORT` | `generador-demo` / `iracing-bridge` | `8080` | Puerto del servidor WebSocket |
| `NEXT_PUBLIC_GENERADOR_DEMO_WS_URL` | `dashboard` / `apex-mobile` | `ws://localhost:8080` | URL del WebSocket al que se conectan las apps |
| `SEED`, `DRIVER_COUNT`, `CLASS_COUNT`, `TRACK_ID` | `generador-demo` | ver `apps/generador-demo/src/main.ts` | Configuración de la sesión simulada |

Ejemplo para correr el generador con más pilotos:

```bash
cd apps/generador-demo
$env:DRIVER_COUNT=30; npm run dev   # PowerShell
DRIVER_COUNT=30 npm run dev          # bash/zsh
```

## Troubleshooting

- **"EADDRINUSE" en el puerto 8080**: hay otro proceso (generador-demo o iracing-bridge) ya corriendo. Cerrar esa ventana de terminal antes de abrir la otra.
- **Dashboard o Apex Mobile muestran "Esperando conexión..."**: verificar que el proceso del puerto 8080 (generador-demo o iracing-bridge) esté corriendo y sin errores en su terminal.
- **`npm install` falla en `iracing-bridge` fuera de Windows**: `irsdk-node` depende de un módulo nativo solo-Windows. Si se está desarrollando en macOS/Linux y no se necesita el bridge, se puede omitir con `npm install --workspace=apps/dashboard --workspace=apps/apex-mobile --workspace=apps/generador-demo` en la raíz, o ignorar el warning si la instalación general no falla.
- **Apex Mobile no actualiza el Service Worker tras un cambio**: en desarrollo el Service Worker está deshabilitado (limitación de Turbopack/Serwist); solo se genera en `npm run build`. Si quedó un `sw.js` viejo cacheado en el navegador, forzar recarga sin caché.
- **Modo real: no llegan datos**: confirmar que iRacing está en una sesión activa (no solo en el menú principal) y que el bridge corre en la misma PC, no en otra máquina de la red.

## Documentación adicional

- [`apps/iracing-bridge/README.md`](apps/iracing-bridge/README.md) — limitaciones detalladas del mapeo de datos reales de iRacing.
- [`.kiro/specs/`](.kiro/specs/) — specs de requisitos/diseño/tareas del proyecto.
