import type {
  Alert,
  ForecastDiario,
  ForecastInput,
  Observation,
  Station,
  Umbral,
  UmbralesActivos,
  Variable,
} from "@/lib/domain/types";

// Contratos de persistencia. En producción (Spring Boot) se convierten en
// interfaces de repositorio implementadas con JPA/Postgres.
// El PoC los implementa con JSON estático + localStorage (ver lib/infra).

export interface StationRepository {
  listar(): Station[];
  porId(id: string): Station | undefined;
}

export interface ObservacionRepository {
  // Serie fusionada (estática + overlay), ordenada y recortada a la ventana.
  serieFusionada(stationId: string, horas?: number): Observation[];
  // Última lectura por estación.
  ultimaValida(): Record<string, Observation>;
  // Reloj del mock: fecha más reciente de la serie fusionada.
  ultimaFecha(): string;
  anexar(obs: Observation): void;
  limpiar(): void;
}

export interface AvisoRepository {
  // Base + persistidos (localStorage).
  listar(): Alert[];
  // Solo los avisos base (alerts.json), para secuencias / restore.
  base(): Alert[];
  guardar(alerts: Alert[]): void;
}

export interface PronosticoRepository {
  inputs(): ForecastInput[];
  diario(stationId?: string): ForecastDiario[];
}

export interface UmbralRepository {
  // Tabla de umbrales: una fila por (estación, variable, tipo, nivel, periodo),
  // con su valor y la vigencia (h) del aviso que genera.
  listar(stationId?: string, variable?: Variable): Umbral[];
  // Activos en la fecha (por tipo y nivel), según el periodo de cada umbral.
  activos(stationId: string, variable: Variable, fecha: string): UmbralesActivos;
  guardarEstacion(stationId: string, umbrales: Umbral[]): void;
  reset(stationId: string): void;
}
