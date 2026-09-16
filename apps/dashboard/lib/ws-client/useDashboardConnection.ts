"use client";

import { useEffect } from "react";
import { createWsClient, handleRawMessage } from "@apex/ws-client-core";
import { dispatchEvent } from "../store/dispatchEvent";
import { createTelemetryBatcher } from "../store/telemetryBatcher";
import { useTelemetryStore } from "../store/telemetryStore";

/**
 * URL por defecto del servidor WebSocket del Generador_Demo cuando no se
 * define `NEXT_PUBLIC_GENERADOR_DEMO_WS_URL`. Coincide con el puerto por
 * defecto (`8080`) usado por `apps/generador-demo/src/main.ts`.
 */
const DEFAULT_GENERADOR_DEMO_WS_URL = "ws://localhost:8080";

/**
 * Hook de inicialización del Dashboard: conecta la tarea 9.1
 * (`createWsClient`), la tarea 9.2 (`handleRawMessage`) y la tarea 10.2
 * (`dispatchEvent`) en un único flujo que se establece al montar la
 * aplicación y se limpia al desmontarla.
 *
 * Flujo de un mensaje entrante: `createWsClient` entrega el string crudo
 * recibido por WebSocket a `handleRawMessage`, que lo parsea y valida
 * contra el Contrato_Datos; si es válido, el evento tipado resultante se
 * enruta según su `type`:
 * - `"telemetry"`: se empuja al `TelemetryBatcher` de la tarea 10.5 en
 *   lugar de despacharse directamente, para agrupar las actualizaciones
 *   de alta frecuencia en una sola por frame de animación (Requisitos
 *   15.1, 15.2).
 * - Cualquier otro tipo (`"standings"`, `"session"`, `"track"`): se
 *   despacha directamente vía `dispatchEvent`, ya que no son eventos de
 *   alta frecuencia y no necesitan batching.
 *
 * SHALL establecer la Conexion_WebSocket con el Generador_Demo en cuanto
 * el Dashboard se inicia (Requisito 14.1), y SHALL enrutar cada mensaje
 * válido recibido hacia el store correspondiente (Requisito 14.2).
 *
 * Este hook no expone ningún estado ni UI: es puramente un efecto de
 * inicialización, pensado para invocarse una única vez desde un
 * componente cliente cercano a la raíz del árbol (ver
 * `ConnectionProvider`).
 */
export function useDashboardConnection(): void {
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_GENERADOR_DEMO_WS_URL ??
      DEFAULT_GENERADOR_DEMO_WS_URL;

    const batcher = createTelemetryBatcher(
      (event) => useTelemetryStore.getState().setTelemetryEvent(event),
    );

    const wsClient = createWsClient(url, (raw) =>
      handleRawMessage(raw, (event) => {
        if (event.type === "telemetry") {
          batcher.push(event);
        } else {
          dispatchEvent(event);
        }
      }),
    );

    return () => {
      wsClient.close();
      batcher.dispose();
    };
  }, []);
}
