/**
 * Live aggregate statistics from GBIF, for the Research dashboard.
 * Everything here is computed by GBIF itself (facet counts over the full
 * backbone taxonomy and occurrence index) — nothing is hand-typed.
 *
 *   Species search facets:    https://techdocs.gbif.org/en/openapi/v1/species
 *   Occurrence search facets: https://techdocs.gbif.org/en/openapi/v1/occurrence
 */
import {
  gbifRequest, toCard, GBIF_BACKBONE, KINGDOM, STATUS_CODE,
  type GbifCard, type GbifTaxon, type KingdomKey,
} from './gbif';

export interface NamedCount { name: string; count: number; }

interface Facet { field: string; counts: { name: string; count: number }[]; }
interface FacetResponse { count: number; facets?: Facet[]; }

const facetCounts = (res: FacetResponse, field: string): NamedCount[] =>
  (res.facets?.find(f => f.field.toUpperCase() === field.toUpperCase())?.counts ?? [])
    .map(c => ({ name: c.name, count: c.count }));

const speciesBase = (kingdom?: KingdomKey) => {
  const p = new URLSearchParams({ rank: 'SPECIES', status: 'ACCEPTED', datasetKey: GBIF_BACKBONE, limit: '0' });
  if (kingdom) p.set('highertaxonKey', String(KINGDOM[kingdom]));
  return p;
};

// ---- IUCN status ordering ---------------------------------------------------
export const IUCN_ORDER = ['CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'EW', 'EX'] as const;
/** Categories GBIF/IUCN count as "threatened". */
export const THREATENED = new Set(['CR', 'EN', 'VU']);

const toIucn = (raw: string): string => STATUS_CODE[raw] ?? raw;

const sortIucn = (rows: NamedCount[]): NamedCount[] =>
  [...rows].sort((a, b) => {
    const ia = IUCN_ORDER.indexOf(a.name as typeof IUCN_ORDER[number]);
    const ib = IUCN_ORDER.indexOf(b.name as typeof IUCN_ORDER[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

// ---- species (checklist) overview -----------------------------------------
export interface KingdomSpecies {
  kingdom: KingdomKey;
  species: number;
  /** IUCN Red List category → number of accepted species, severity-ordered. */
  iucn: NamedCount[];
}

export interface SpeciesOverview {
  kingdoms: KingdomSpecies[];
  totalSpecies: number;
  /** Habitat facet for Animals (marine / terrestrial / freshwater). */
  animalHabitats: NamedCount[];
}

export const fetchSpeciesOverview = async (): Promise<SpeciesOverview> => {
  const kingdoms = Object.keys(KINGDOM) as KingdomKey[];
  const responses = await Promise.all(kingdoms.map(k => {
    const p = speciesBase(k);
    p.append('facet', 'threat');
    p.set('facetLimit', '20');
    return gbifRequest<FacetResponse>(`/species/search?${p}`);
  }));

  const result: KingdomSpecies[] = kingdoms.map((kingdom, i) => ({
    kingdom,
    species: responses[i].count,
    iucn: sortIucn(facetCounts(responses[i], 'THREAT').map(c => ({ name: toIucn(c.name), count: c.count }))),
  }));

  const habitatParams = speciesBase('Animals');
  habitatParams.append('facet', 'habitat');
  habitatParams.set('facetLimit', '10');
  const habitats = await gbifRequest<FacetResponse>(`/species/search?${habitatParams}`)
    .then(r => facetCounts(r, 'HABITAT'))
    .catch(() => []);

  return {
    kingdoms: result,
    totalSpecies: result.reduce((s, k) => s + k.species, 0),
    animalHabitats: habitats,
  };
};

// ---- occurrence overview ------------------------------------------------
const BASIS_LABEL: Record<string, string> = {
  HUMAN_OBSERVATION: 'Human observation',
  MACHINE_OBSERVATION: 'Machine observation',
  PRESERVED_SPECIMEN: 'Preserved specimen',
  OBSERVATION: 'Observation',
  MATERIAL_SAMPLE: 'Material sample',
  LIVING_SPECIMEN: 'Living specimen',
  FOSSIL_SPECIMEN: 'Fossil specimen',
  MATERIAL_CITATION: 'Literature',
  OCCURRENCE: 'Occurrence',
  UNKNOWN: 'Unknown',
};

const KINGDOM_LABEL: Record<string, string> = {
  '1': 'Animals', '2': 'Archaea', '3': 'Bacteria', '4': 'Chromista',
  '5': 'Fungi', '6': 'Plants', '7': 'Protozoa', '8': 'Viruses', '0': 'Unplaced',
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryName = (code: string): string => {
  try { return regionNames.of(code) ?? code; } catch { return code; }
};

export interface OccurrenceOverview {
  totalRecords: number;
  basisOfRecord: NamedCount[];
  kingdoms: NamedCount[];
  topCountries: NamedCount[];
}

export const fetchOccurrenceOverview = async (): Promise<OccurrenceOverview> => {
  const p = new URLSearchParams({ limit: '0', facetLimit: '12' });
  p.append('facet', 'basisOfRecord');
  p.append('facet', 'kingdomKey');
  p.append('facet', 'country');
  const res = await gbifRequest<FacetResponse>(`/occurrence/search?${p}`);
  return {
    totalRecords: res.count,
    basisOfRecord: facetCounts(res, 'BASIS_OF_RECORD').map(c => ({ name: BASIS_LABEL[c.name] ?? c.name, count: c.count })),
    kingdoms: facetCounts(res, 'KINGDOM_KEY').map(c => ({ name: KINGDOM_LABEL[c.name] ?? c.name, count: c.count })),
    topCountries: facetCounts(res, 'COUNTRY').slice(0, 10).map(c => ({ name: countryName(c.name), count: c.count })),
  };
};

/** Occurrence records published per year (event year), oldest → newest. */
export const fetchRecordsByYear = async (from = 1990): Promise<NamedCount[]> => {
  const thisYear = new Date().getFullYear();
  const p = new URLSearchParams({ limit: '0', year: `${from},${thisYear}`, facetLimit: String(thisYear - from + 1) });
  p.append('facet', 'year');
  const res = await gbifRequest<FacetResponse>(`/occurrence/search?${p}`);
  return facetCounts(res, 'YEAR').sort((a, b) => Number(a.name) - Number(b.name));
};

// ---- spotlight: critically endangered animals ------------------------------
export const fetchSpotlight = async (n = 6): Promise<GbifCard[]> => {
  const p = speciesBase('Animals');
  p.set('limit', '60');
  p.set('threat', 'CRITICALLY_ENDANGERED');
  const res = await gbifRequest<{ results: GbifTaxon[] }>(`/species/search?${p}`);
  const seen = new Set<number>();
  const cards = res.results
    .filter(t => t.key && !seen.has(t.key) && seen.add(t.key))
    .filter(t => (t.vernacularNames?.length ?? 0) > 0) // prefer species people know by name
    .map(toCard);
  return cards.slice(0, n);
};
