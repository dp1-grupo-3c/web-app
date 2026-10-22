/**
 * Modelos del backend Spring (KindBox), tal como los serializa Jackson.
 * Ver GUIA_FLUJO_DATOS.md en la raíz del proyecto para el contrato completo.
 *
 * No confundir con src/lib/types.ts (el dominio del frontend): estos tipos
 * son el punto de entrada crudo; src/lib/data/adapters.ts los traduce.
 */

export type TipoEscenario = "DIA_A_DIA" | "SIMULACION_5D" | "COLAPSO";
export type EstadoCorrida = "PREPARADA" | "EN_CURSO" | "CULMINADA" | "CANCELADA" | "COLAPSADA" | "FALLIDA";
export type TipoUnidad = "AUTO" | "MOTO" | "BICICLETA";
export type EstadoUnidad =
  | "DISPONIBLE" | "EN_RUTA" | "ENTREGANDO" | "EN_ALIMENTACION"
  | "ABASTECIENDO" | "AVERIADA" | "EN_MANTENIMIENTO";
export type ColorSemaforo = "VERDE" | "AMBAR" | "ROJO";

export type MensajeVisualizador =
  | { tipo: "corrida"; corrida: string; carga: ResumenCorrida }
  | { tipo: "instantanea"; corrida: string; carga: InstantaneaSimulacion }
  | { tipo: "resultado"; corrida: string; carga: ResultadoSimulacion };

export interface InstantaneaSimulacion {
  minutoSimulado: number;
  fechaHoraSimulada: string;
  estado: EstadoCorrida;
  milisegundosReales: number;
  unidades: VistaUnidad[];
  almacenes: VistaAlmacen[];
  bloqueosVigentes: VistaBloqueo[];
  pedidosPendientes: number;
  metricas: MetricasSimulacion;
}

export interface VistaUnidad {
  codigo: string;
  tipo: TipoUnidad;
  estado: EstadoUnidad;
  x: number;
  y: number;
  cargaABordo: number;
  capacidad: number;
  caminoRecorrido: number[];
  caminoPendiente: number[];
  destinoX: number;
  destinoY: number;
  minutosHastaDestino: number;
  pedidosABordo: { idPedido: number; enLaUnidad: number; totalDelPedido: number }[];
  tipoAveria: number;
}

export interface VistaAlmacen {
  id: number;
  nombre: string;
  x: number;
  y: number;
  central: boolean;
  disponible: number;
  capacidad: number;
  color: ColorSemaforo;
}

export interface VistaBloqueo {
  nodos: number[];
  minutoInicio: number;
  minutoFin: number;
}

export interface MetricasSimulacion {
  pedidosRegistrados: number;
  pedidosEntregados: number;
  pedidosPendientes: number;
  pedidosConEntregaParcial: number;
  unidadesEntregadas: number;
  pedidosIncumplidos: number;
  costoAcumulado: number;
  kilometrosPorTipo: Record<TipoUnidad, number>;
  /** Promedios en minutos ya calculados por el backend; no son sumas. */
  minutosEntregaPorPlazo: Record<string, number>;
  entregasPorPlazo: Record<string, number>;
  activacionesSemaforo: { minuto: number; nombreAlmacen: string; color: ColorSemaforo; disponible: number }[];
  averiasPorTipo: Record<string, number>;
  ejecucionesPlanificador: number;
  milisegundosPlanificador: number;
}

export interface ResumenCorrida {
  id: string;
  tipo: TipoEscenario;
  algoritmo: string;
  estado: EstadoCorrida;
  primerDia: string;
  ultimoDia: string;
  duracionMinutosReales: number;
  saltoMinutos: number;
  factorAceleracion: number;
  minutosEntreFotografias: number;
  semilla: number;
  minutoSimulado: number;
  minutosHorizonte: number;
  fechaHoraSimulada: string;
  milisegundosReales: number;
  pedidosDelEscenario: number;
  unidadesDeLaFlota: number;
  unidadesActivasPorTipo: Record<TipoUnidad, number>;
  productosEntregados: number;
  motor: string;
  error: string | null;
  avisos: string[];
}

export interface ResultadoSimulacion {
  configuracion: {
    tipo: TipoEscenario;
    primerDia: string;
    ultimoDia: string;
    saltoMinutos: number;
    factorAceleracion: number;
    modoReloj: string;
    algoritmo: string;
    semilla: number;
    minutosEntreFotografias: number;
    generarAverias: boolean;
    averiasPorUnidadPorTurno: number;
    arranqueDesdePlanVigente: boolean;
  };
  estado: EstadoCorrida;
  minutoFinal: number;
  fechaHoraFinal: string;
  milisegundosReales: number;
  metricas: MetricasSimulacion;
  minutoPrimerIncumplimiento: number;
  pedidoDelPrimerIncumplimiento: number;
  mensaje: string;
}

export interface SolicitudSimulacion {
  tipo: TipoEscenario;
  primerDia: string;
  ultimoDia: string;
  duracionMinutosReales: number;
  saltoMinutos: number;
  minutosEntreFotografias: number;
  algoritmo: "HGS" | "ALNS";
  semilla: number;
  generarAverias: boolean;
}

export interface DetalleCorrida {
  corrida: ResumenCorrida;
  instantanea: InstantaneaSimulacion | null;
  resultado: ResultadoSimulacion | null;
  averias: string[];
}

export interface PaginaPedidos {
  filas: FilaPedido[];
  pagina: number;
  tamano: number;
  totalFilas: number;
  totalPaginas: number;
  busqueda: string;
  soloActivos: boolean;
}

export interface FilaPedido {
  id: number;
  cliente: string;
  paquetes: number;
  pendientes: number;
  x: number;
  y: number;
  plazoHoras: number;
  registro: string;
  limite: string;
  holguraMinutos: number;
  entregado: boolean;
  semaforo: ColorSemaforo;
}

export interface RespuestaSalud {
  estado: "vivo";
  instante: string;
  directorioDatos: string;
  datosDisponibles: boolean;
  motor: string;
  algoritmos: string[];
  corridaActiva: string | null;
  corridasConocidas: number;
  clientesConectados: number;
}

export interface VistaParametros {
  velocidades: Record<TipoUnidad, number>;
  tipos: { tipo: TipoUnidad; prefijo: string; etiqueta: string; capacidad: number; velocidadVigente: number; velocidadDelEnunciado: number; costoPorKm: number }[];
  umbralSemaforoAmbar: number;
  umbralSemaforoVerde: number;
  capacidadMinima: number;
  capacidadMaxima: number;
  minutosAcondicionamiento: number;
  minutosAlimentacion: number;
  minutosSeparacionCambioTurno: number;
  minutosTrasvase: number;
  version: number;
}

export interface RespuestaAveria {
  placa: string;
  tipo: number;
  minutoSimulado: number;
  fechaHoraSimulada: string;
  minutoReincorporacion: number;
  mensaje: string;
}

export interface ResultadoCargaAverias {
  leidas: number;
  aplicadas: number;
  programadas: number;
  avisos: string[];
}

export interface ErrorBackend {
  codigo: number;
  codigoError: string;
  tipo: string;
  error: string;
  mensaje: string;
  ruta: string;
  instante: string;
}
