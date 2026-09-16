# Requirements Document

## Introduction

Esta especificación define la primera fase de una plataforma de telemetría para iRacing, compuesta por: (1) un contrato de datos JSON versionado y portable que describe los eventos de una sesión de carrera, (2) un generador de datos demo que produce dichos eventos de forma procedural en tiempo real y los transmite por WebSocket, y (3) un Race Engineer Dashboard (aplicación de escritorio construida con Next.js y TypeScript) que consume esos eventos y los presenta en un panel tipo "pit wall" con estética de broadcast profesional de motorsport/e-sports.

El objetivo de esta fase es validar el contrato de datos, la experiencia visual y la arquitectura de consumo en tiempo real, dejando el contrato preparado para ser reutilizado sin cambios por un futuro bridge del SDK real de iRacing y por una futura aplicación móvil.

## Glossary

- **Sistema**: El conjunto formado por el Contrato_Datos, el Generador_Demo y el Dashboard descritos en esta especificación.
- **Contrato_Datos**: La definición versionada de la estructura JSON de los cuatro tipos de evento (Evento_Telemetry, Evento_Standings, Evento_Session, Evento_Track) que viajan entre el Generador_Demo (o un futuro bridge real) y cualquier consumidor (el Dashboard o una futura app móvil).
- **Version_Contrato**: El identificador de versión semántica incluido en cada mensaje del Contrato_Datos.
- **Evento_Telemetry**: Mensaje del Contrato_Datos emitido a alta frecuencia (aproximadamente 60 Hz) con los datos instantáneos del vehículo del piloto observado.
- **Evento_Standings**: Mensaje del Contrato_Datos emitido a baja frecuencia (entre 1 Hz y 5 Hz) con la clasificación de todos los pilotos de la sesión.
- **Evento_Session**: Mensaje del Contrato_Datos emitido cuando cambia el estado global de la sesión (tipo de sesión, clima, bandera, tiempo/vueltas restantes, incidentes).
- **Evento_Track**: Mensaje del Contrato_Datos emitido una única vez por sesión con la información estática del circuito.
- **Generador_Demo**: El componente de software que produce datos sintéticos de carrera de forma procedural en tiempo real, cumpliendo el Contrato_Datos, y los transmite mediante Conexion_WebSocket.
- **Conexion_WebSocket**: El canal de comunicación local basado en WebSocket mediante el cual el Generador_Demo transmite los eventos del Contrato_Datos a los consumidores.
- **Dashboard**: La aplicación web de escritorio (Next.js con App Router y TypeScript) que consume los eventos vía Conexion_WebSocket y renderiza el Race Engineer Dashboard.
- **Panel_Mapa**: La sección del Dashboard que muestra el trazado del circuito y la posición de cada piloto por sector.
- **Panel_Clasificacion**: La sección del Dashboard que muestra la tabla de clasificación multi-clase en vivo.
- **Panel_Telemetria**: La sección del Dashboard que muestra el gráfico de throttle/brake trace por vuelta, con delta de sector y comparación contra una vuelta de referencia.
- **Panel_Clima**: La sección del Dashboard que muestra la temperatura de pista, la temperatura ambiente y la condición climática.
- **Panel_Fuel**: La sección del Dashboard que muestra la planificación de combustible y de stints.
- **Vuelta_Referencia**: La vuelta seleccionada por el usuario o determinada por el Sistema contra la cual se compara la vuelta actual en el Panel_Telemetria.

## Requirements

### Requisito 1: Estructura del Evento_Telemetry

**User Story:** Como ingeniero de pista, quiero recibir datos instantáneos del vehículo a alta frecuencia, para poder analizar el comportamiento de manejo en tiempo real.

#### Acceptance Criteria

1. THE Contrato_Datos SHALL definir el Evento_Telemetry con los campos speed, rpm, gear, throttle, brake, steering, fuel_level, lap_dist_pct, current_lap_time, last_lap_time, best_lap_time, delta_to_best, delta_to_prev, position, track_temp y air_temp.
2. THE Contrato_Datos SHALL incluir en cada Evento_Telemetry un campo de Version_Contrato y una marca de tiempo.
3. WHERE el Generador_Demo emite Evento_Telemetry, THE Generador_Demo SHALL emitir dicho evento a una frecuencia de aproximadamente 60 Hz.
4. THE Contrato_Datos SHALL definir tipos de dato numéricos para speed, rpm, throttle, brake, steering, fuel_level, lap_dist_pct, track_temp y air_temp.

### Requisito 2: Estructura del Evento_Standings

**User Story:** Como ingeniero de pista, quiero ver la clasificación de todos los pilotos en vivo, para poder tomar decisiones estratégicas sobre la carrera.

#### Acceptance Criteria

1. THE Contrato_Datos SHALL definir el Evento_Standings como una lista de pilotos, donde cada piloto incluye posición, clase, gap, última vuelta, mejor vuelta y estado en pits o fuera de pista.
2. THE Contrato_Datos SHALL incluir en cada Evento_Standings un campo de Version_Contrato y una marca de tiempo.
3. WHERE el Generador_Demo emite Evento_Standings, THE Generador_Demo SHALL emitir dicho evento a una frecuencia entre 1 Hz y 5 Hz.

### Requisito 3: Estructura del Evento_Session

**User Story:** Como ingeniero de pista, quiero conocer el estado global de la sesión, para poder anticipar cambios de bandera o clima que afecten la estrategia.

#### Acceptance Criteria

1. THE Contrato_Datos SHALL definir el Evento_Session con los campos tipo de sesión, clima, bandera actual, vueltas o tiempo restante, e incidentes.
2. THE Contrato_Datos SHALL incluir en cada Evento_Session un campo de Version_Contrato y una marca de tiempo.
3. WHEN cambia el estado global de la sesión, THE Generador_Demo SHALL emitir un nuevo Evento_Session.

### Requisito 4: Estructura del Evento_Track

**User Story:** Como ingeniero de pista, quiero conocer la información estática del circuito, para poder visualizar el mini-mapa con las posiciones de los pilotos.

#### Acceptance Criteria

1. THE Contrato_Datos SHALL definir el Evento_Track con los campos nombre del circuito, longitud y coordenadas del trazado para el mini-mapa.
2. THE Contrato_Datos SHALL incluir en cada Evento_Track un campo de Version_Contrato.
3. WHEN se inicia una sesión, THE Generador_Demo SHALL emitir exactamente un Evento_Track para dicha sesión.

### Requisito 5: Versionado y portabilidad del Contrato_Datos

**User Story:** Como arquitecto del Sistema, quiero un contrato de datos versionado y agnóstico del origen de los datos, para poder reutilizarlo sin cambios en un futuro bridge real de iRacing y en una futura app móvil.

#### Acceptance Criteria

1. THE Contrato_Datos SHALL documentar la estructura de los cuatro tipos de evento en un esquema versionado independiente del código del Generador_Demo.
2. THE Contrato_Datos SHALL identificar cada tipo de evento mediante un campo de tipo explícito que distinga entre telemetry, standings, session y track.
3. THE Contrato_Datos SHALL definir su estructura sin incluir referencias a la implementación del Generador_Demo ni a un futuro bridge del SDK de iRacing.
4. IF un consumidor recibe un mensaje con un Version_Contrato no soportado, THEN THE Contrato_Datos SHALL especificar que dicho mensaje debe poder identificarse como incompatible antes de su procesamiento.

### Requisito 6: Simulación procedural de sesión de carrera

**User Story:** Como usuario del Dashboard, quiero un generador de datos demo que simule una sesión de carrera plausible, para poder probar el Dashboard sin depender de iRacing ni de un dataset grabado.

#### Acceptance Criteria

1. THE Generador_Demo SHALL producir los datos de la sesión mediante generación procedural en tiempo real, sin reproducir un dataset previamente grabado.
2. WHILE la sesión demo está en curso, THE Generador_Demo SHALL avanzar el progreso de vuelta de cada piloto simulado de forma continua.
3. THE Generador_Demo SHALL simular cambios de posición entre los pilotos a lo largo de la sesión.
4. THE Generador_Demo SHALL simular paradas en pits para al menos un piloto durante la sesión.
5. WHILE un piloto simulado está en pista, THE Generador_Demo SHALL reducir progresivamente el nivel de combustible de dicho piloto para simular degradación de combustible.
6. THE Generador_Demo SHALL simular variación de las condiciones climáticas durante la sesión.
7. THE Generador_Demo SHALL simular pilotos de al menos dos clases distintas de forma simultánea en la misma sesión.
8. THE Generador_Demo SHALL producir cada evento respetando exactamente la estructura definida en el Contrato_Datos para su tipo correspondiente.

### Requisito 7: Transmisión de eventos por WebSocket

**User Story:** Como desarrollador del Dashboard, quiero recibir los eventos del Generador_Demo mediante una conexión WebSocket local, para poder consumirlos en tiempo real sin un agente bridge nativo.

#### Acceptance Criteria

1. THE Generador_Demo SHALL exponer una Conexion_WebSocket local a través de la cual transmitir los cuatro tipos de evento del Contrato_Datos.
2. WHEN un consumidor establece una Conexion_WebSocket con el Generador_Demo, THE Generador_Demo SHALL comenzar a transmitir los eventos de la sesión en curso a dicho consumidor.
3. IF la Conexion_WebSocket con un consumidor se interrumpe, THEN THE Generador_Demo SHALL continuar la simulación de la sesión sin detenerse.
4. THE Generador_Demo SHALL transmitir los eventos sin requerir un agente bridge nativo de Windows.

### Requisito 8: Layout modular por tabs del Dashboard

**User Story:** Como ingeniero de pista, quiero un dashboard organizado en un layout modular por tabs, para poder acceder a cada panel de análisis de forma ordenada.

#### Acceptance Criteria

1. THE Dashboard SHALL presentar el Panel_Mapa, el Panel_Clasificacion, el Panel_Telemetria, el Panel_Clima y el Panel_Fuel organizados en un layout modular por tabs desde la primera versión.
2. WHEN el usuario selecciona un tab del Dashboard, THE Dashboard SHALL mostrar el panel correspondiente a dicho tab.
3. THE Dashboard SHALL construirse usando Next.js con App Router y TypeScript.

### Requisito 9: Panel_Mapa del circuito

**User Story:** Como ingeniero de pista, quiero ver el trazado del circuito con la posición de todos los pilotos por sector, para poder ubicar espacialmente la carrera.

#### Acceptance Criteria

1. THE Panel_Mapa SHALL renderizar el trazado del circuito a partir de las coordenadas recibidas en el Evento_Track.
2. WHEN el Dashboard recibe un Evento_Standings o un Evento_Telemetry con progreso de vuelta actualizado, THE Panel_Mapa SHALL actualizar la posición mostrada de los pilotos afectados sobre el trazado.
3. THE Panel_Mapa SHALL distinguir visualmente el sector del circuito en el que se encuentra cada piloto.

### Requisito 10: Panel_Clasificacion multi-clase

**User Story:** Como ingeniero de pista, quiero ver la clasificación en vivo separada por clase, para poder seguir la posición relativa dentro de cada categoría.

#### Acceptance Criteria

1. THE Panel_Clasificacion SHALL mostrar, para cada piloto recibido en el Evento_Standings, su posición, clase, gap, última vuelta, mejor vuelta y estado en pits o fuera de pista.
2. THE Panel_Clasificacion SHALL agrupar o distinguir visualmente a los pilotos según su clase.
3. WHEN el Dashboard recibe un nuevo Evento_Standings, THE Panel_Clasificacion SHALL actualizar la tabla de clasificación mostrada.

### Requisito 11: Panel_Telemetria con throttle/brake trace

**User Story:** Como ingeniero de pista, quiero visualizar el trace de throttle y brake por vuelta comparado contra una vuelta de referencia, para poder identificar oportunidades de mejora de manejo.

#### Acceptance Criteria

1. THE Panel_Telemetria SHALL graficar los valores de throttle y brake recibidos en el Evento_Telemetry en función del progreso de la vuelta actual.
2. THE Panel_Telemetria SHALL mostrar el delta de sector calculado a partir de los campos delta_to_best y delta_to_prev del Evento_Telemetry.
3. WHEN el usuario selecciona una Vuelta_Referencia, THE Panel_Telemetria SHALL superponer el trace de throttle y brake de la Vuelta_Referencia sobre el trace de la vuelta actual.
4. WHEN el Dashboard recibe un nuevo Evento_Telemetry, THE Panel_Telemetria SHALL actualizar el trace mostrado sin reiniciar la comparación contra la Vuelta_Referencia seleccionada.

### Requisito 12: Panel_Clima de clima y pista

**User Story:** Como ingeniero de pista, quiero ver la temperatura de pista, la temperatura ambiente y la condición climática, para poder anticipar el efecto del clima en la estrategia.

#### Acceptance Criteria

1. THE Panel_Clima SHALL mostrar la temperatura de pista y la temperatura ambiente recibidas en el Evento_Telemetry o en el Evento_Session.
2. THE Panel_Clima SHALL mostrar la condición climática actual recibida en el Evento_Session.
3. WHEN el Dashboard recibe un Evento_Session con un cambio de condición climática, THE Panel_Clima SHALL actualizar la condición climática mostrada.

### Requisito 13: Panel_Fuel de planificación de combustible y stints

**User Story:** Como ingeniero de pista, quiero ver la planificación de combustible y de stints, para poder decidir cuándo debe entrar a pits cada piloto.

#### Acceptance Criteria

1. THE Panel_Fuel SHALL mostrar el nivel de combustible actual del piloto observado a partir del campo fuel_level del Evento_Telemetry.
2. THE Panel_Fuel SHALL mostrar una estimación de las vueltas restantes disponibles según el nivel de combustible actual y el consumo observado.
3. WHEN el Dashboard recibe un nuevo Evento_Telemetry, THE Panel_Fuel SHALL actualizar el nivel de combustible y la estimación de vueltas restantes mostrados.

### Requisito 14: Consumo de eventos vía WebSocket en el Dashboard

**User Story:** Como usuario del Dashboard, quiero que la aplicación se conecte automáticamente al generador demo, para poder ver los datos de la sesión sin configuración manual adicional.

#### Acceptance Criteria

1. WHEN el Dashboard se inicia, THE Dashboard SHALL establecer una Conexion_WebSocket con el Generador_Demo.
2. WHEN el Dashboard recibe un mensaje por la Conexion_WebSocket, THE Dashboard SHALL interpretar dicho mensaje según el Contrato_Datos y dirigirlo al panel correspondiente según su tipo de evento.
3. IF la Conexion_WebSocket se interrumpe, THEN THE Dashboard SHALL intentar restablecer la Conexion_WebSocket automáticamente.
4. IF el Dashboard recibe un mensaje cuyo Version_Contrato no es compatible, THEN THE Dashboard SHALL descartar dicho mensaje sin interrumpir la actualización de los demás paneles.

### Requisito 15: Rendimiento en tiempo real de las actualizaciones de alta frecuencia

**User Story:** Como ingeniero de pista, quiero que las actualizaciones de telemetría de alta frecuencia se muestren de forma fluida, para poder analizar el manejo sin distracciones visuales.

#### Acceptance Criteria

1. WHILE el Dashboard recibe Evento_Telemetry a aproximadamente 60 Hz, THE Panel_Telemetria SHALL actualizar su representación visual sin bloquear la interacción del usuario con el resto del Dashboard.
2. THE Dashboard SHALL mantener la interfaz de usuario respondiendo a las interacciones del usuario mientras procesa las actualizaciones de alta frecuencia del Evento_Telemetry.

### Requisito 16: Estética visual de broadcast profesional de motorsport

**User Story:** Como usuario del Dashboard, quiero una interfaz con estética de broadcast profesional de motorsport/e-sports, para que la herramienta transmita una calidad de producto real.

#### Acceptance Criteria

1. THE Dashboard SHALL utilizar un tema visual oscuro en todos sus paneles.
2. THE Dashboard SHALL presentar una densidad de información alta, mostrando de forma simultánea los datos definidos para cada panel sin ocultarlos detrás de pasos adicionales de navegación.
3. THE Dashboard SHALL utilizar tipografía condensada de estilo racing HUD para los valores numéricos de telemetría y clasificación.

### Requisito 17: Stack tecnológico del Dashboard

**User Story:** Como desarrollador del Dashboard, quiero que la implementación respete el stack tecnológico indicado, para mantener consistencia con las decisiones de arquitectura acordadas.

#### Acceptance Criteria

1. THE Dashboard SHALL construirse con Next.js, TypeScript y App Router.
2. THE Dashboard SHALL utilizar Tailwind CSS y componentes de shadcn/ui con un theming neón personalizado.
3. THE Dashboard SHALL utilizar Framer Motion para las animaciones de transición entre estados de la interfaz.
4. THE Dashboard SHALL utilizar una librería de gráficos entre D3, Recharts o visx para renderizar el Panel_Telemetria.
5. THE Dashboard SHALL utilizar WebSocket nativo o socket.io como mecanismo de Conexion_WebSocket.
6. THE Dashboard SHALL utilizar Zustand o Jotai para la gestión del estado de la aplicación.

## Fuera de alcance

Los siguientes elementos quedan explícitamente fuera del alcance de esta especificación y podrán abordarse en especificaciones futuras:

- **Apex Mobile PWA**: la aplicación para dispositivos móviles no se diseña ni se implementa en esta fase. El Contrato_Datos se define de forma portable para permitir su reutilización futura por dicha app.
- **Bridge real de iRacing SDK**: no se implementa ningún agente o bridge que lea memoria compartida del SDK real de iRacing en Windows. El Generador_Demo sustituye temporalmente esta fuente de datos.
- **Modo Cloud AWS**: no se implementa infraestructura en AWS (IoT Core, Lambda, DynamoDB, Timestream, API Gateway WebSocket, CDK, Cognito, S3+CloudFront) ni ningún otro servicio en la nube.
- **Modo replay de dataset grabado**: no se implementa un modo de reproducción de sesiones grabadas; la generación de datos demo es exclusivamente procedural en tiempo real.
