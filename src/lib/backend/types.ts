/**
 * Modelos del backend Spring (KindBox), tal como los serializa Jackson.
 * Ver GUIA_FLUJO_DATOS.md en la raíz del proyecto para el contrato completo.
 *
 * No confundir con src/lib/types.ts (el dominio del frontend): estos tipos
 * son el punto de entrada crudo; src/lib/data/adapters.ts los traduce.
 */

export type TipoEscenario = "DIA_A_DIA" | "SIMULACION_5D" | "COLAPSO";
/** DATOS_AGOTADOS: el colapso se quedó sin archivos de ventas antes de que venciera ningún pedido. */
export type EstadoCorrida = "PREPARADA" | "EN_CURSO" | "CULMINADA" | "CANCELADA" | "COLAPSADA" | "DATOS_AGOTADOS" | "FALLIDA";
export type TipoUnidad = "AUTO" | "MOTO" | "BICICLETA";
export type EstadoUnidad =
  | "DISPONIBLE" | "EN_RUTA" | "ENTREGANDO" | "EN_ALIMENTACION"
  | "ABASTECIENDO" | "AVERIADA" | "EN_MANTENIMIENTO";
// VACIO: almacén sin stock o unidad sin carga.
export type ColorSemaforo = "VERDE" | "AMBAR" | "ROJO" | "VACIO";

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
  /**
   * Entregas pendientes del itinerario, en orden. `viaje` cuenta las recargas en
   * almacén que la preceden: solo `viaje === 0` va de verdad a bordo.
   */
  pedidosABordo: { idPedido: number; enLaUnidad: number; totalDelPedido: number; viaje: number }[];
  tipoAveria: number;
  // Llegando va hacia una parada; saliendo espera salir de una.
  fase?: "LLEGANDO" | "SALIENDO" | "SIN_RUTA";
  minutoSalidaTramo?: number;
  minutoLlegadaTramo?: number;
  // Ultimo almacén donde cargó (-1 sin dato) y minuto en que salió de él.
  idAlmacenOrigen?: number;
  minutoSalidaAlmacen?: number;
}

/** Entrega registrada por el motor (las de las últimas 24 h simuladas). */
export interface EntregaRegistrada {
  minuto: number;
  fechaHora: string;
  idPedido: number;
  codigoUnidad: string;
  idAlmacenCarga: number;
  cantidad: number;
}

/** Respuesta de …/almacenes/{almacen}/envios; aquí solo se usan las entregas. */
export interface EnviosAlmacen {
  horas: number;
  minuto: number;
  entregados: EntregaRegistrada[];
  paquetesEntregados: number;
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
  /** Arranque elegido y su minuto: minutoSimulado cuenta desde las 00:00 del primer día. */
  fechaHoraInicio: string;
  minutoInicial: number;
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
  /** Fecha y hora de arranque al minuto ("2026-09-02T10:30"); su fecha debe ser primerDia. */
  inicio?: string;
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

/** Parte de un pedido que lleva una unidad; `fechaHoraLlegada` es la llegada estimada (null si no se conoce). */
export interface EnvioPedido {
  codigoUnidad: string;
  cantidad: number;
  fechaHoraLlegada: string | null;
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
  /** Fecha y hora simuladas en que se completó; null si aún no se entrega. */
  entrega: string | null;
  /** Placas de las unidades que lo descargaron, en orden de descarga. */
  unidadesEntrega: string[];
  semaforo: ColorSemaforo;
  envios: EnvioPedido[];
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
  /** Cantidad de unidades por tipo vigente en el servidor (PUT /parametros/flota). */
  cantidades?: Record<TipoUnidad, number>;
  tipos: { tipo: TipoUnidad; prefijo: string; etiqueta: string; capacidad: number; velocidadVigente: number; velocidadDelEnunciado: number; costoPorKm: number }[];
  umbralSemaforoAmbar: number;
  umbralSemaforoVerde: number;
  umbralOcupacionAmbar: number;
  umbralOcupacionRojo: number;
  capacidadMinima: number;
  capacidadMaxima: number;
  minutosAcondicionamiento: number;
  minutosAlimentacion: number;
  minutosSeparacionCambioTurno: number;
  minutosTrasvase: number;
  averias: FichaAveria[];
  version: number;
}

export interface AtributosAveria {
  minutosEnElLugar: number;
  turnosHastaReincorporacion: number;
  diasMantenimiento: number;
}

export interface FichaAveria {
  tipo: number;
  atributos: AtributosAveria;
  trasladaAlmacenCentral: boolean;
  regla: string;
}

// ---- Parámetros del mundo (/api/parametros/mundo) ------------------------------

export interface AlmacenMundo {
  id: number;
  nombre: string;
  x: number;
  y: number;
  central: boolean;
  /** null en el central, que es ilimitado. */
  capacidad: number | null;
}

export interface VistaMundo {
  version: number;
  mapa: { largoKm: number; anchoKm: number };
  almacenes: AlmacenMundo[];
  /** Tipo de la ejecución en curso, que impide editar. */
  ejecucionActiva: string | null;
}

export interface SolicitudMundo {
  mapa: { largoKm: number; anchoKm: number };
  almacenes: { id: number; x: number; y: number; capacidad?: number }[];
}

/** Cuerpo de PUT /api/parametros/averias: lo que no llega conserva su valor vigente. */
export type SolicitudAtributosAveria = { tipo: 1 | 2 | 3 } & Partial<AtributosAveria>;

/**
 * PROPUESTA — cuerpo de PUT /api/parametros/flota, que el backend aún no
 * implementa (ver cambiarFlota en api.ts). Lleva los tres tipos juntos para
 * que el cambio sea atómico.
 */
export interface SolicitudFlota {
  unidades: Record<TipoUnidad, { cantidad: number; kmPorHora: number }>;
}

// ---- Datos (/api/datos) ------------------------------------------------------

/** `flota` es null si no hay archivo y se usaría la del enunciado. */
export interface InventarioDatos {
  flota: string | null;
  ventas: string[];
  bloqueos: string[];
  mantenimiento: string[];
}

/** Cuerpo de POST /api/datos/bloqueos/manual: fechas al minuto ("2026-09-02T10:30"). */
export interface SolicitudBloqueo {
  nodos: { x: number; y: number }[];
  inicio: string;
  fin: string;
}

export interface ArchivoGuardado {
  ruta: string;
  registros: number;
  reemplazado: boolean;
}

// Bloqueo guardado: mes y línea lo identifican para editarlo o borrarlo.
export interface VistaRegistroBloqueo {
  mes: string;
  archivo: string;
  linea: number;
  registro: string;
  inicio: string;
  fin: string;
  nodos: { x: number; y: number }[];
}

// Reporte de la última planificación estable (GET …/plan).
export interface ParadaPlan {
  tipo: "ABASTECIMIENTO" | "ENTREGA" | "ALIMENTACION";
  x: number;
  y: number;
  idPedido: number;
  idAlmacen: number;
  cantidad: number;
  minutoLlegada: number;
  minutoSalida: number;
  fechaHoraLlegada: string;
  fechaHoraSalida: string;
}

export interface RutaPlan {
  codigoUnidad: string;
  tipoUnidad: TipoUnidad;
  kilometros: number;
  costo: number;
  paradas: ParadaPlan[];
}

export interface PlanVigente {
  minuto: number;
  fechaHora: string;
  algoritmo: string;
  rutas: RutaPlan[];
  // Paquetes sin asignar por id de pedido.
  sinAsignar: Record<string, number>;
  kilometros: number;
  costo: number;
  paquetesPlanificados: number;
}

export interface ReportePlan {
  id: string;
  escenario: string;
  estado: string;
  terminado: boolean;
  fechaHora: string;
  // Nulo antes de la primera planificación.
  plan: PlanVigente | null;
  metricas: MetricasSimulacion;
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

// ---- Operaciones diarias (/api/operaciones, /ws/operaciones) -------------
// Ver docs/OPERACIONES_DIARIAS.md del backend. Las fechas LocalDateTime
// llegan en ISO sin zona y ya están en la zona de la operación.

export type EstadoOperacion = "EN_CURSO" | "DETENIDA" | "FALLIDA";
export type EstadoPedido =
  | "REGISTRADO" | "PLANIFICADO" | "EN_TRANSITO" | "EN_REPLANIFICACION"
  | "ENTREGADO_PARCIALMENTE" | "ENTREGADO" | "CANCELADO";
export type PrioridadPedido = "NORMAL" | "PRIORITARIO_4" | "PRIORITARIO_3" | "PRIORITARIO_2" | "PRIORITARIO_1";
export type EstadoComando = "ACEPTADO" | "APLICADO" | "RECHAZADO";

export interface ConfiguracionOperacion {
  zonaHoraria: string;
  saltoMinutos: number;
  algoritmo: string;
  semilla: number;
  presupuestoPlanificacionMs: number;
}

export interface ParametrosOperacionInstantanea {
  /** Indexado por el ordinal de TipoUnidad: AUTO, MOTO, BICICLETA. */
  velocidadKmH: number[];
  minutosAcondicionamiento: number;
  minutosAlimentacion: number;
  minutosSeparacionCambioTurno: number;
  minutosTrasvase: number;
  umbralSemaforoAmbar: number;
  umbralSemaforoVerde: number;
  version: number;
}

export interface VistaPedidoOperacion {
  id: number;
  codigoCliente: string;
  nombreCliente: string;
  telefonoCliente: string;
  direccion: string;
  x: number;
  y: number;
  cantidad: number;
  pendiente: number;
  prioridad: PrioridadPedido;
  estado: EstadoPedido;
  incumplido: boolean;
  registro: string;
  limite: string;
  transiciones: { estado: EstadoPedido; fechaHora: string }[];
  /** Placas de las unidades que lo descargaron, en orden de descarga. */
  unidadesEntrega: string[];
  envios: EnvioPedido[];
}

export interface IncidenteOperacion {
  comandoId: string;
  placa: string;
  tipo: number;
  inicio: string;
  reincorporacion: string | null;
  resuelto: boolean;
}

export interface VistaOperacion {
  contextoId: string;
  revision: number;
  estado: EstadoOperacion;
  zonaHoraria: string;
  horaServidor: string;
  fechaHoraOperativa: string;
  /** Arranque de la operación y minutos de reloj real transcurridos desde entonces. */
  inicio: string;
  fechaHoraInicio: string;
  minutosTranscurridos: number;
  configuracion: ConfiguracionOperacion;
  instantanea: InstantaneaSimulacion;
  parametros: ParametrosOperacionInstantanea;
  pedidos: VistaPedidoOperacion[];
  incidentes: IncidenteOperacion[];
  avisos: string[];
  calculando: boolean;
  planesDescartados: number;
  error: string | null;
}

export interface ResultadoComando {
  comandoId: string;
  estado: EstadoComando;
  aceptado: string;
  aplicado: string | null;
  pedidoId: number | null;
  error: string | null;
}

export interface PaginaPedidosOperacion {
  contextoId: string;
  revision: number;
  pedidos: VistaPedidoOperacion[];
  pagina: number;
  tamanoPagina: number;
  totalPedidos: number;
  totalPaginas: number;
}

export type SolicitudOperacion = Partial<ConfiguracionOperacion>;

export interface SolicitudPedidoOperacion {
  solicitudId: string;
  codigoCliente: string;
  nombreCliente: string;
  telefonoCliente: string;
  direccion: string;
  x: number;
  y: number;
  cantidad: number;
  prioridad: PrioridadPedido;
}

export interface SolicitudAveriaOperacion {
  solicitudId: string;
  placa: string;
  tipo: 1 | 2 | 3;
}

export interface SolicitudParametrosOperacion {
  solicitudId: string;
  velocidades?: Partial<Record<TipoUnidad, number>>;
  ambar?: number;
  verde?: number;
}

// ---- Clientes (/api/clientes) ----------------------------------------------

export type TipoCliente = "PERSONA" | "EMPRESA";

export interface Cliente {
  tipo: TipoCliente;
  /** DNI (8 dígitos) o RUC (11). Es el codigoCliente de sus pedidos. */
  documento: string;
  nombre: string;
  telefono: string;
  contacto: string | null;
  direccion: string;
  x: number;
  y: number;
  registrado: string;
  actualizado: string;
}

export type SolicitudCliente = Omit<Cliente, "registrado" | "actualizado">;

export interface ErrorBackend {
  codigo: number;
  codigoError: string;
  tipo: string;
  error: string;
  mensaje: string;
  ruta: string;
  instante: string;
}
