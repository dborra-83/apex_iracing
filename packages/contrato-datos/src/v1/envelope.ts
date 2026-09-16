import { z } from "zod";

/**
 * Conjunto de versiones de Version_Contrato soportadas por este paquete.
 * Cualquier mensaje cuyo `version_contrato` no esté en este conjunto SHALL
 * poder identificarse como incompatible antes de intentar interpretar el
 * resto del payload (Requisito 5.4).
 */
export const SUPPORTED_CONTRACT_VERSIONS = ["1.0.0", "1.1.0"] as const;

export type SupportedContractVersion = (typeof SUPPORTED_CONTRACT_VERSIONS)[number];

/**
 * Envelope base común a los cuatro tipos de evento del Contrato_Datos.
 * Todo evento SHALL incluir `version_contrato` y `timestamp` (Requisitos
 * 1.2, 2.2, 3.2, 4.2).
 */
export const BaseEnvelopeSchema = z.object({
  version_contrato: z.string(),
  timestamp: z.number(), // epoch ms
});

export type BaseEnvelope = z.infer<typeof BaseEnvelopeSchema>;

/**
 * Determina si una version_contrato dada está soportada por este paquete.
 * Se usa para clasificar un mensaje como incompatible antes de validar el
 * resto de su payload (Requisitos 5.1, 5.3, 5.4).
 */
export function isSupportedVersion(version: string): boolean {
  return (SUPPORTED_CONTRACT_VERSIONS as readonly string[]).includes(version);
}
