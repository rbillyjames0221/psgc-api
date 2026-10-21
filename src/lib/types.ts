/** Shared PSGC types used by the import scripts and the Next.js app. */

export type GeoLevel = "Reg" | "Prov" | "City" | "Mun" | "SubMun" | "Bgy";

export interface Region {
  code: string;
  name: string;
  correspondenceCode: string | null;
  population: number | null;
  provinceCount: number;
  cityCount: number;
  municipalityCount: number;
  subMunicipalityCount: number;
  barangayCount: number;
}

export interface Province {
  code: string;
  name: string;
  regionCode: string;
  correspondenceCode: string | null;
  oldNames: string | null;
  incomeClass: string | null;
  population: number | null;
  remarks: string | null;
  cityCount: number;
  municipalityCount: number;
  barangayCount: number;
}

export type CityClass = "HUC" | "ICC" | "CC";

export interface CityMunicipality {
  code: string;
  name: string;
  type: "City" | "Mun";
  /** HUC = Highly Urbanized City, ICC = Independent Component City, CC = Component City. null for municipalities. */
  cityClass: CityClass | null;
  incomeClass: string | null;
  regionCode: string;
  /** The administrative province. null for HUCs, NCR LGUs, the City of Isabela and the BARMM Special Geographic Area. */
  provinceCode: string | null;
  /** Geographic province (where the LGU sits on the map) for cities that are independent of a province, when known. */
  geographicProvinceCode: string | null;
  /** Code of a non-province grouping row in the PSA file (e.g. "City of Isabela (Not a Province)", "Special Geographic Area"). */
  specialAreaCode: string | null;
  isCapital: boolean;
  correspondenceCode: string | null;
  oldNames: string | null;
  population: number | null;
  subMunicipalityCount: number;
  barangayCount: number;
}

export interface SubMunicipality {
  code: string;
  name: string;
  cityMunicipalityCode: string;
  regionCode: string;
  correspondenceCode: string | null;
  population: number | null;
  barangayCount: number;
}

export interface Barangay {
  code: string;
  name: string;
  regionCode: string;
  provinceCode: string | null;
  cityMunicipalityCode: string;
  subMunicipalityCode: string | null;
  urbanRural: "U" | "R" | null;
  isPoblacion: boolean;
  correspondenceCode: string | null;
  oldNames: string | null;
  population: number | null;
}

export interface SpecialArea {
  code: string;
  name: string;
  regionCode: string;
  correspondenceCode: string | null;
  population: number | null;
  note: string;
}

export interface Counts {
  regions: number;
  provinces: number;
  cities: number;
  highlyUrbanizedCities: number;
  independentComponentCities: number;
  componentCities: number;
  municipalities: number;
  subMunicipalities: number;
  barangays: number;
}

export interface Meta {
  /** Machine-friendly version id, e.g. "2026-Q3". Compare this to detect new data. */
  version: string;
  quarter: number;
  year: number;
  releaseName: string;
  releaseDate: string | null;
  referenceNo: string | null;
  asOf: string | null;
  sourcePage: string;
  sourceFile: string;
  sourceFileName: string;
  counts: Counts;
  psaPublishedTotals?: Partial<Counts>;
  totalsMatch?: boolean;
  importedAt: string;
  attribution: string;
  notes: string[];
}

export interface Dataset {
  meta: Meta;
  regions: Region[];
  provinces: Province[];
  citiesMunicipalities: CityMunicipality[];
  subMunicipalities: SubMunicipality[];
  barangays: Barangay[];
  specialAreas: SpecialArea[];
}
