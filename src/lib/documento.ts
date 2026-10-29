/**
 * Validación de documentos de identidad peruanos. Replica las reglas de
 * ServicioClientes en el backend para avisar antes de enviar.
 */

import type { ClientKind } from "@/lib/types";

export const DOCUMENT_LENGTH: Record<ClientKind, number> = { persona: 8, empresa: 11 };
export const DOCUMENT_LABEL: Record<ClientKind, string> = { persona: "DNI", empresa: "RUC" };

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Dígito verificador de SUNAT: módulo 11 sobre los diez primeros dígitos. */
export function rucCheckDigitOk(ruc: string): boolean {
  const suma = PESOS_RUC.reduce((s, peso, i) => s + Number(ruc[i]) * peso, 0);
  const resto = 11 - (suma % 11);
  return (resto === 10 ? 0 : resto === 11 ? 1 : resto) === Number(ruc[10]);
}

/** Tipo de cliente que corresponde a un documento completo, o null si su longitud no es de DNI ni de RUC. */
export const kindForDocument = (document: string): ClientKind | null =>
  /^\d{8}$/.test(document) ? "persona" : /^\d{11}$/.test(document) ? "empresa" : null;

/** Mensaje de error o undefined si el documento es admisible para ese tipo de cliente. */
export function documentError(kind: ClientKind, document: string): string | undefined {
  if (!document) return "Completa este campo para continuar.";
  if (kind === "persona") return /^\d{8}$/.test(document) ? undefined : "El DNI tiene 8 dígitos.";
  if (!/^\d{11}$/.test(document)) return "El RUC tiene 11 dígitos.";
  // RUC 10: persona natural con negocio; RUC 20: persona jurídica. Ambos se registran como empresa.
  if (!/^(10|20)/.test(document)) return "El RUC de una empresa empieza con 10 o 20.";
  return rucCheckDigitOk(document) ? undefined : "Este RUC no es válido. Revisa los dígitos.";
}
