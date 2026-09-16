# Requirements Document

## Introduction

Esta especificación amplía la plataforma de telemetría iRacing construida en `iracing-telemetry-platform` en dos frentes simultáneos: (1) el Race Engineer Dashboard existente gana densidad de datos por-piloto (gap adelante/atrás, comparativa de sectores entre rivales, stint/fuel planning multi-piloto), y (2) se construye desde cero Apex Mobile, una PWA de pantalla única (sin tabs ni navegación) pensada para el piloto mientras maneja. Ambos frentes comparten una única ampliación aditiva y retrocompatible del Contrato_Datos (versión 1.1.0) y paquetes de lógica pura compartidos entre ambas aplicaciones.

## Glossary

- **Sistema**: El conjunto formado por el Contrato_Datos ampliado, el Generador_Demo ampliado, el Dashboard ampliado y Apex Mobile descritos en esta especificación.
- **Contrato_Datos**: La definición versionada de la estructura JSON de los eventos, ya existente desde `iracing-telemetry-platform`, ahora ampliada con la Version_Contrato_1_1.
- **Version_Contrato_1_0**: El identificador de versión `"1.0.0"` del Contrato_Datos ya implementado, sin cambios en esta especificación salvo por seguir siendo una versión soportada.
- **Version_Contrato_1_1**: El identificador de versión `"1.1.0"` del Contrato_Datos, que amplía `Evento_Standings` de forma aditiva con datos por-piloto adicionales.
- **Evento_Standings_Ampliado**: La forma de `Evento_Standings` bajo Version_Contrato_1_1, que incluye para cada piloto, además de los campos ya existentes en Version_Contrato_1_0, los campos `lap_dist_pct`, `fuel_level`, `last_sector_times` y `best_sector_times`.
- **Gap_Adelante**: El intervalo de tiempo, en segundos, entre un piloto y el piloto inmediatamente delante de él en la clasificación.
- **Gap_Atras**: El intervalo de tiempo, en segundos, entre un piloto y el piloto inmediatamente detrás de él en la clasificación.
- **Tiempos_Sector**: El conjunto de tiempos de sector (última vuelta y mejor vuelta) de un piloto, identificado por el índice de sector definido en el Evento_Track de la sesión.
- **Comparativa_Sectores**: La vista que confronta los Tiempos_Sector del piloto observado contra los Tiempos_Sector de un piloto rival seleccionado.
- **Stint_Planning_Multi_Piloto**: La vista que muestra, para todos los pilotos de la sesión (no solo el observado), el combustible actual, las vueltas restantes estimadas y la vuelta estimada de próxima entrada a pits.
- **Rivales_Cercanos**: El subconjunto de pilotos (excluyendo al piloto observado) más próximos al piloto observado según su progreso de vuelta (`lap_dist_pct`), usado para el MiniMap de Apex Mobile.
- **Dashboard**: La aplicación Next.js ya existente (`apps/dashboard`), ampliada por esta especificación con más densidad de datos en sus paneles ya existentes.
- **Apex_Mobile**: La nueva aplicación PWA (`apps/apex-mobile`), construida con Next.js y next-pwa, de pantalla única, sin tabs ni navegación interna.
- **Piloto_Observado**: El piloto cuya telemetría detallada (Evento_Telemetry) se transmite, igual que en `iracing-telemetry-platform`.
- **Panel_Clasificacion**: El panel ya existente del Dashboard, ampliado con Gap_Adelante y Gap_Atras.
- **Panel_Telemetria**: El panel ya existente del Dashboard, ampliado con Comparativa_Sectores.
- **Panel_Fuel**: El panel ya existente del Dashboard, ampliado con Stint_Planning_Multi_Piloto.
- **Panel_Mapa**: El panel ya existente del Dashboard, ampliado para mostrar la posición de todos los pilotos de la sesión, no solo del Piloto_Observado.
- **Pantalla_Principal**: La única pantalla de Apex_Mobile, que contiene de forma simultánea el velocímetro, indicador de marcha, tiempos de vuelta, posición y gaps, combustible y el mini-mapa.
- **MiniMap**: El componente de Apex_Mobile que muestra el trazado del circuito con la posición propia y los Rivales_Cercanos.
- **Telemetry_Core**: El paquete compartido (`packages/telemetry-core`) de funciones puras de cálculo (gaps, comparativa de sectores, stint multi-piloto, proyección geométrica) reutilizado por el Dashboard y por Apex_Mobile.
- **Ws_Client_Core**: El paquete compartido (`packages/ws-client-core`) del cliente WebSocket con reconexión automática, reutilizado por el Dashboard y por Apex_Mobile.

## Requirements

### Requisito 1: Ampliación aditiva del Contrato_Datos a Version_Contrato_1_1

**User Story:** Como arquitecto del Sistema, quiero ampliar el Contrato_Datos de forma aditiva y retrocompatible, para poder alimentar los nuevos cálculos de ambos frentes sin romper la compatibilidad con la Version_Contrato_1_0 ya implementada.

#### Acceptance Criteria

1. THE Contrato_Datos SHALL definir la Version_Contrato_1_1 como una extensión de Evento_Standings que añade, para cada piloto, los campos lap_dist_pct, fuel_level, last_sector_times y best_sector_times, sin eliminar ni cambiar de tipo ningún campo existente en la Version_Contrato_1_0.
2. THE Contrato_Datos SHALL mantener Evento_Telemetry, Evento_Session y Evento_Track sin cambios de estructura entre la Version_Contrato_1_0 y la Version_Contrato_1_1.
3. THE Contrato_Datos SHALL reconocer simultáneamente la Version_Contrato_1_0 y la Version_Contrato_1_1 como versiones soportadas.
4. WHEN un consumidor recibe un Evento_Standings con Version_Contrato_1_0, THE Contrato_Datos SHALL validarlo contra la estructura original sin los campos nuevos.
5. WHEN un consumidor recibe un Evento_Standings con Version_Contrato_1_1, THE Contrato_Datos SHALL validarlo contra la estructura ampliada con los campos nuevos.
6. IF un consumidor recibe un mensaje con un Version_Contrato distinto de la Version_Contrato_1_0 y la Version_Contrato_1_1, THEN THE Contrato_Datos SHALL identificar dicho mensaje como incompatible antes de intentar interpretar el resto de su payload.
7. THE Contrato_Datos SHALL definir last_sector_times y best_sector_times como listas de longitud igual al número de sectores definidos en el Evento_Track de la sesión, donde cada posición puede ser un número o nulo.

### Requisito 2: Emisión de Version_Contrato_1_1 por el Generador_Demo

**User Story:** Como desarrollador del Sistema, quiero que el Generador_Demo emita la información ampliada por-piloto, para poder alimentar los nuevos cálculos de gap, sectores y stint planning multi-piloto.

#### Acceptance Criteria

1. THE Generador_Demo SHALL emitir todos sus eventos (telemetry, standings, session, track) con Version_Contrato_1_1.
2. THE Generador_Demo SHALL incluir, en cada Evento_Standings, el lap_dist_pct y el fuel_level actuales de cada piloto de la sesión.
3. WHEN un piloto simulado completa un sector del circuito, THE Generador_Demo SHALL registrar el tiempo de dicho sector en el last_sector_times de ese piloto.
4. WHEN el tiempo de sector registrado para un piloto y un sector es menor que el best_sector_times previamente registrado para ese piloto y ese sector (o no existe uno previo), THE Generador_Demo SHALL actualizar el best_sector_times de ese piloto y ese sector.
5. THE Generador_Demo SHALL inicializar last_sector_times y best_sector_times de cada piloto con listas de valores nulos de longitud igual al número de sectores del circuito, antes de que dicho piloto complete su primer sector.

### Requisito 3: Cálculo de Gap_Adelante y Gap_Atras

**User Story:** Como ingeniero de pista o como piloto, quiero ver el gap respecto al piloto inmediatamente delante y detrás de mí, para poder tomar decisiones de ritmo y estrategia sin tener que inferirlo manualmente del gap al líder.

#### Acceptance Criteria

1. THE Telemetry_Core SHALL calcular, para cada piloto de un Evento_Standings, su Gap_Adelante y su Gap_Atras a partir de los campos position y gap ya existentes en el Evento_Standings, sin requerir campos adicionales del Contrato_Datos para este cálculo.
2. FOR el piloto con la posición más alta en la clasificación (el líder), THE Telemetry_Core SHALL devolver un Gap_Adelante nulo.
3. FOR el piloto con la posición más baja en la clasificación (el último), THE Telemetry_Core SHALL devolver un Gap_Atras nulo.
4. FOR cualquier piloto que no sea el líder, THE Telemetry_Core SHALL calcular su Gap_Adelante como un valor mayor o igual a cero.
5. FOR cualquier par de pilotos adyacentes en la clasificación, THE Telemetry_Core SHALL calcular el Gap_Atras del piloto delantero como un valor idéntico al Gap_Adelante del piloto trasero.

### Requisito 4: Comparativa de sectores entre rivales

**User Story:** Como ingeniero de pista, quiero comparar los tiempos de sector del piloto observado contra los de un rival seleccionado, para poder identificar en qué parte del circuito se pierde o gana tiempo relativo a ese rival.

#### Acceptance Criteria

1. THE Panel_Telemetria SHALL permitir seleccionar un piloto rival de entre los pilotos presentes en el Evento_Standings_Ampliado.
2. WHEN el usuario selecciona un piloto rival, THE Panel_Telemetria SHALL mostrar, para cada sector del circuito, el tiempo de sector del Piloto_Observado, el tiempo de sector del rival seleccionado y la diferencia entre ambos.
3. IF el tiempo de sector del Piloto_Observado o del rival seleccionado no está disponible (es nulo) para un sector determinado, THEN THE Panel_Telemetria SHALL mostrar dicho sector como sin diferencia calculable, sin mostrar un valor numérico inventado.
4. THE Panel_Telemetria SHALL mantener sin cambios el trace de throttle/brake del Piloto_Observado ya existente: la Comparativa_Sectores SHALL mostrarse como información adicional, no SHALL reemplazar dicho trace.

### Requisito 5: Stint planning multi-piloto en Panel_Fuel

**User Story:** Como ingeniero de pista, quiero ver la planificación de combustible y de stint de todos los pilotos de la sesión, para poder anticipar cuándo debe entrar a pits cada uno de ellos, no solo el piloto observado.

#### Acceptance Criteria

1. THE Panel_Fuel SHALL mostrar, para cada piloto presente en el Evento_Standings_Ampliado, su nivel de combustible actual y una estimación de sus vueltas restantes disponibles.
2. THE Panel_Fuel SHALL calcular la estimación de vueltas restantes de cada piloto a partir del historial de fuel_level de ese piloto, siguiendo el mismo método ya usado para el Piloto_Observado en `iracing-telemetry-platform`.
3. WHEN la estimación de vueltas restantes de un piloto es un valor finito, THE Panel_Fuel SHALL mostrar la vuelta relativa estimada en la que dicho piloto necesitaría entrar a pits.
4. WHEN la estimación de vueltas restantes de un piloto es infinita (consumo de combustible no determinado), THE Panel_Fuel SHALL mostrar dicha estimación de forma explícita como no disponible, sin mostrar una vuelta de entrada a pits inventada.
5. THE Panel_Fuel SHALL permitir ordenar la lista de pilotos por urgencia de entrada a pits (menor cantidad de vueltas restantes primero).

### Requisito 6: Posición de todos los pilotos en Panel_Mapa

**User Story:** Como ingeniero de pista, quiero ver la posición de todos los pilotos de la sesión sobre el trazado, no solo la del piloto observado, para poder entender la disposición espacial completa de la carrera.

#### Acceptance Criteria

1. THE Panel_Mapa SHALL mostrar la posición de cada piloto presente en el Evento_Standings_Ampliado sobre el trazado del circuito, usando el lap_dist_pct de cada piloto.
2. WHEN el Dashboard recibe un nuevo Evento_Standings_Ampliado, THE Panel_Mapa SHALL actualizar la posición mostrada de todos los pilotos afectados.

### Requisito 7: Extensión de columnas de Gap en Panel_Clasificacion

**User Story:** Como ingeniero de pista, quiero ver el Gap_Adelante y el Gap_Atras de cada piloto directamente en la tabla de clasificación, para no tener que calcularlos manualmente a partir del gap al líder.

#### Acceptance Criteria

1. THE Panel_Clasificacion SHALL mostrar, para cada piloto, su Gap_Adelante y su Gap_Atras además del gap al líder ya mostrado en `iracing-telemetry-platform`.
2. WHEN el Dashboard recibe un nuevo Evento_Standings_Ampliado, THE Panel_Clasificacion SHALL actualizar el Gap_Adelante y el Gap_Atras mostrados para cada piloto.

### Requisito 8: Apex Mobile como PWA de pantalla única

**User Story:** Como piloto, quiero una aplicación móvil de pantalla única sin pestañas ni navegación, para poder consultar mis datos de un vistazo mientras conduzco, sin necesitar cambiar de vista.

#### Acceptance Criteria

1. THE Apex_Mobile SHALL presentar todos sus datos en una única Pantalla_Principal, sin tabs ni navegación entre vistas.
2. THE Apex_Mobile SHALL construirse como una Progressive Web App instalable, usando Next.js y next-pwa.
3. THE Apex_Mobile SHALL adaptar el layout de la Pantalla_Principal tanto a orientación portrait como landscape, mostrando en ambas el mismo conjunto de datos.
4. WHEN el dispositivo cambia de orientación portrait a landscape o viceversa, THE Apex_Mobile SHALL conservar el estado de la conexión y de los datos ya recibidos, sin reiniciar la sesión.

### Requisito 9: Contenido de datos de la Pantalla_Principal de Apex Mobile

**User Story:** Como piloto, quiero ver de un vistazo velocidad, RPM, marcha, tiempos de vuelta, posición, gaps, combustible y un mini-mapa con rivales cercanos, para tener toda la información crítica de carrera sin distraerme buscándola.

#### Acceptance Criteria

1. THE Pantalla_Principal SHALL mostrar un velocímetro circular con la velocidad instantánea del Piloto_Observado recibida en el Evento_Telemetry.
2. THE Pantalla_Principal SHALL mostrar el rpm del Piloto_Observado junto con un indicador visual de shift lights derivado del rpm.
3. THE Pantalla_Principal SHALL mostrar la marcha actual del Piloto_Observado.
4. THE Pantalla_Principal SHALL mostrar el tiempo de vuelta actual, la mejor vuelta, el delta a la vuelta anterior y el delta a la vuelta óptima del Piloto_Observado.
5. THE Pantalla_Principal SHALL mostrar la posición del Piloto_Observado junto con su Gap_Adelante y su Gap_Atras.
6. THE Pantalla_Principal SHALL mostrar el combustible restante del Piloto_Observado y una estimación de las vueltas restantes disponibles.
7. THE Pantalla_Principal SHALL mostrar un MiniMap del trazado con la posición del Piloto_Observado y la posición de sus Rivales_Cercanos.

### Requisito 10: Cálculo de Rivales_Cercanos

**User Story:** Como piloto, quiero que el mini-mapa muestre a los rivales más próximos a mi posición en pista, para poder anticipar maniobras de adelantamiento o defensa sin necesitar la clasificación completa.

#### Acceptance Criteria

1. THE Telemetry_Core SHALL calcular los Rivales_Cercanos a partir del lap_dist_pct del Piloto_Observado y del lap_dist_pct de cada uno de los demás pilotos del Evento_Standings_Ampliado.
2. THE Telemetry_Core SHALL excluir siempre al Piloto_Observado del conjunto de Rivales_Cercanos calculado.
3. THE Telemetry_Core SHALL calcular la proximidad entre pilotos tratando el progreso de vuelta como un circuito cerrado, de modo que un piloto cercano al final de la vuelta y un piloto cercano al inicio de la vuelta puedan considerarse próximos entre sí.
4. THE Telemetry_Core SHALL devolver los Rivales_Cercanos ordenados de menor a mayor proximidad respecto al Piloto_Observado.

### Requisito 11: Estética visual diferenciada de Apex Mobile

**User Story:** Como piloto, quiero una interfaz de máxima legibilidad a distancia con fondo oscuro y acentos cian/neón, para poder leer los datos de un vistazo rápido mientras conduzco, priorizando la claridad sobre la densidad de información.

#### Acceptance Criteria

1. THE Apex_Mobile SHALL utilizar un tema visual de fondo oscuro en su Pantalla_Principal.
2. THE Apex_Mobile SHALL utilizar acentos de color cian/neón para resaltar los valores numéricos críticos de la Pantalla_Principal.
3. THE Apex_Mobile SHALL utilizar tipografía condensada para los valores numéricos de la Pantalla_Principal.
4. THE Apex_Mobile SHALL priorizar la legibilidad y el contraste de sus valores críticos (velocidad, marcha, shift lights) sobre la cantidad de datos mostrados simultáneamente, a diferencia del Dashboard.

### Requisito 12: Portabilidad de código entre Dashboard y Apex Mobile

**User Story:** Como desarrollador del Sistema, quiero que el Dashboard y Apex Mobile reutilicen la misma lógica de dominio y el mismo cliente de conexión, para evitar duplicar cálculos críticos y mantener consistencia entre ambas aplicaciones.

#### Acceptance Criteria

1. THE Sistema SHALL implementar el cálculo de Gap_Adelante/Gap_Atras, la Comparativa_Sectores, el Stint_Planning_Multi_Piloto y el cálculo de Rivales_Cercanos como funciones puras del paquete Telemetry_Core, sin dependencias de un framework de UI específico.
2. THE Dashboard SHALL reutilizar las funciones de Telemetry_Core sin reimplementar su lógica de cálculo.
3. THE Apex_Mobile SHALL reutilizar las funciones de Telemetry_Core sin reimplementar su lógica de cálculo.
4. THE Sistema SHALL implementar el cliente de conexión WebSocket con reconexión automática como el paquete Ws_Client_Core, reutilizado tanto por el Dashboard como por Apex_Mobile.
5. THE Apex_Mobile SHALL consumir el mismo servidor WebSocket del Generador_Demo ya utilizado por el Dashboard, sin requerir un servidor o endpoint adicional.

### Requisito 13: Compatibilidad hacia atrás ante Evento_Standings sin los campos ampliados

**User Story:** Como arquitecto del Sistema, quiero que los nuevos cálculos degraden explícitamente cuando reciben datos sin los campos ampliados, para evitar mostrar información incorrecta derivada de valores por defecto inventados.

#### Acceptance Criteria

1. IF el Dashboard o Apex_Mobile reciben un Evento_Standings con Version_Contrato_1_0 (sin lap_dist_pct, fuel_level, last_sector_times ni best_sector_times por piloto), THEN THE Sistema SHALL mostrar el Stint_Planning_Multi_Piloto, la Comparativa_Sectores y los Rivales_Cercanos como datos no disponibles, sin asumir valores por defecto para los campos ausentes.
2. IF el Dashboard o Apex_Mobile reciben un Evento_Standings con Version_Contrato_1_0, THEN THE Sistema SHALL seguir calculando y mostrando el Gap_Adelante y el Gap_Atras con normalidad, dado que dicho cálculo no depende de los campos nuevos.

## Fuera de alcance

Los siguientes elementos quedan explícitamente fuera del alcance de esta especificación, en continuidad con lo ya excluido en `iracing-telemetry-platform`:

- **Bridge real de iRacing SDK**: no se implementa ningún agente o bridge que lea memoria compartida del SDK real de iRacing en Windows.
- **Modo Cloud AWS**: no se implementa infraestructura en la nube de ningún proveedor.
- **Modo replay de dataset grabado**: la generación de datos sigue siendo exclusivamente procedural en tiempo real mediante el Generador_Demo ya existente.
- **Autenticación y autorización del servidor WebSocket**: el servidor sigue sin credenciales ni control de acceso, consistente con su alcance de uso local/LAN de confianza.
- **Throttle/brake trace de alta frecuencia de pilotos rivales**: la Comparativa_Sectores se basa en tiempos de sector agregados (Version_Contrato_1_1), no en la transmisión del trace instantáneo de throttle/brake de todos los pilotos.
