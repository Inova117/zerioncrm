// ============================================================================
// cityCatalog — catálogo curado de ciudades de Ecuador por poder adquisitivo.
// Fuente de datos: investigación de Hermes (no IA especulativa). El decisor
// diario SOLO elige de esta lista; nunca genera ciudades nuevas.
//
// Fuentes (ago 2026): PIB per cápita urbano — Quito $9.707, Guayaquil $9.301
// (La Hora, abr 2026); ranking de actividad (Quito/Guayaquil motores; bloque
// intermedio Machala/Cuenca/Manta); sectores ricos: Cumbayá/Tumbaco/La Carolina
// (Quito), Samborondón/Vía a la Costa/Puerto Santa Ana (Guayaquil).
// ============================================================================

export interface CityEntry {
  key: string; // 'quito'
  label: string; // 'Quito'
  /** 1 = motores (mayor PIB), 2 = intermedio, 3 = secundarias. */
  tier: 1 | 2 | 3;
  /** USD. PIB per cápita urbano, si lo tenemos. */
  gdpPerCapita?: number;
  /** Por qué (poder adquisitivo / sectores ricos). */
  note: string;
  /** Sectores ricos para refinar la búsqueda. */
  zones: string[];
}

export const CITIES: CityEntry[] = [
  {
    key: 'quito', label: 'Quito', tier: 1, gdpPerCapita: 9707,
    note: 'Capital; mayor PIB per cápita. PYMES con capacidad de pago en norte y valles.',
    zones: ['Cumbayá', 'Tumbaco', 'La Carolina', 'Iñaquito', 'Valle de los Chillos'],
  },
  {
    key: 'guayaquil', label: 'Guayaquil', tier: 1, gdpPerCapita: 9301,
    note: 'Motor comercial; puerto. Zona rica: Samborondón, Vía a la Costa, norte.',
    zones: ['Samborondón', 'Puerto Santa Ana', 'Urdesa', 'Kennedy', 'Vía a la Costa', 'Daule'],
  },
  { key: 'cuenca', label: 'Cuenca', tier: 2, note: '3ra ciudad; clase media sólida, servicios, alto costo de vida.', zones: [] },
  { key: 'machala', label: 'Machala', tier: 2, note: 'Agroexportación (banano/oro); bloque intermedio de PIB.', zones: [] },
  { key: 'manta', label: 'Manta', tier: 2, note: 'Puerto + turismo; zona top para invertir (2025).', zones: [] },
  { key: 'ambato', label: 'Ambato', tier: 2, note: 'Comercio y manufactura; economía intermedia.', zones: [] },
  { key: 'loja', label: 'Loja', tier: 3, note: 'Economía media; polo universitario.', zones: [] },
  { key: 'riobamba', label: 'Riobamba', tier: 3, note: 'Economía media.', zones: [] },
  { key: 'ibarra', label: 'Ibarra', tier: 3, note: 'Economía media.', zones: [] },
  { key: 'santo-domingo', label: 'Santo Domingo', tier: 3, note: 'Comercio agro.', zones: [] },
  { key: 'portoviejo', label: 'Portoviejo', tier: 3, note: 'Capital de Manabí.', zones: [] },
  { key: 'salinas', label: 'Salinas / La Libertad', tier: 3, note: 'Costa, turismo y retiro.', zones: [] },
];

export function cityByKey(key: string): CityEntry | undefined {
  return CITIES.find((c) => c.key === key);
}

export function citiesByTier(tier: 1 | 2 | 3): CityEntry[] {
  return CITIES.filter((c) => c.tier === tier);
}

/** Orden de selección por defecto: tier 1 → 2 → 3, orden estable de la lista. */
export function defaultCityOrder(): CityEntry[] {
  return [...CITIES].sort((a, b) => a.tier - b.tier);
}