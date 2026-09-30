import type {
  Alert,
  ConfigRecord,
  ForecastDiario,
  ForecastInput,
  Observation,
  Station,
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

export interface ConfigRepository {
  // Tabla de configuración: umbrales + vigencia por (estación, variable, periodo).
  registros(stationId?: string, variable?: Variable): ConfigRecord[];
  vigente(stationId: string, variable: Variable, fecha: string): ConfigRecord | null;
  guardar(record: ConfigRecord): void;
  reset(stationId: string, variable?: Variable): void;
}
