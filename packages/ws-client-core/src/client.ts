/**
 * Cliente WebSocket con reconexión automática (backoff exponencial acotado).
 *
 * Responsabilidad de esta tarea (9.1): únicamente conexión, reconexión y
 * entrega del mensaje crudo (string) recibido por `onEvent`. El parseo y
 * validación contra el Contrato_Datos (`handleRawMessage` + `parseEvent`)
 * se implementa en la tarea 9.2, de forma separada.
 *
 * _Requirements: 14.1, 14.3, 17.5_
 */

const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8000;

export interface WsClient {
  /**
   * Cierra la conexión actual y evita que se programen nuevos intentos de
   * reconexión tras el cierre explícito solicitado por el usuario.
   */
  close: () => void;
}

/**
 * Crea un cliente WebSocket que se conecta a `url` usando el `WebSocket`
 * nativo del navegador, reintentando la conexión automáticamente con
 * backoff exponencial acotado cada vez que la conexión se cierra
 * (salvo que el cierre haya sido solicitado explícitamente vía `close()`).
 *
 * @param url URL del servidor WebSocket (Generador_Demo).
 * @param onEvent callback invocado con el string crudo de cada mensaje recibido.
 */
export function createWsClient(
  url: string,
  onEvent: (raw: string) => void
): WsClient {
  let socket: WebSocket | null = null;
  let retryDelayMs = INITIAL_RETRY_DELAY_MS;
  let isClosedByUser = false;

  function connect(): void {
    if (isClosedByUser) return;

    socket = new WebSocket(url);

    socket.onmessage = (msg: MessageEvent) => {
      onEvent(msg.data);
    };

    socket.onopen = () => {
      retryDelayMs = INITIAL_RETRY_DELAY_MS;
    };

    socket.onclose = () => {
      if (isClosedByUser) return;
      setTimeout(connect, retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
    };
  }

  connect();

  return {
    close: () => {
      isClosedByUser = true;
      socket?.close();
    },
  };
}
