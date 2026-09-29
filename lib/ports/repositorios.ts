import type {
  Alert,
  ConfigEstacion,
  ForecastDiario,
  ForecastInput,
  Observation,
  Station,
  Thresholds,
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
  // Última lectura válida (qc1-ok) por estación.
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

export interface ConfigRepository {
  umbrales(): Thresholds[];
  configMap(): Record<string, ConfigEstacion>;
  guardar(stationId: string, partial: Partial<ConfigEstacion>): void;
  reset(stationId?: string): void;
}
