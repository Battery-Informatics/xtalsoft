export interface Preset {
  id: string;
  name: string;
  description?: string;
  chemicalFormulas: string;
  minAtoms: number;
  maxAtoms: number;
  numInitial: number;
  popSize: number;
  maxNumStructures: number;
  optimizer: string;
  directRunCommand: string;
  ginTemplate: string;
  referenceEnergies?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExperimentItem {
  exp_id: string;
  name: string;
  status: string;
  pid?: number | null;
  created_at?: string;
  chemicalFormulas?: string;
  optimizer?: string;
  config?: any;
}

export interface ExperimentCreatePayload {
  exp_id?: string;
  name?: string;
  description?: string;
  chemicalFormulas: string;
  minAtoms: number;
  maxAtoms: number;
  numInitial: number;
  parentsPoolSize: number;
  maxNumStructures: number;
  optimizer: string;
  directRunCommand: string;
  ginTemplate: string;
  referenceEnergies?: string | null;
  start_immediately: boolean;
}

export interface RunStatusResponse {
  exp_id: string;
  status: string;
  pid?: number | null;
  exit_code?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  elapsed_seconds?: number | null;
  message?: string | null;
}

export interface PopulationBreakdown {
  total_generated: number;
  currently_optimizing: number;
  queued: number;
  completed_optimized: number;
  duplicate: number;
  failed: number;
  best_enthalpy_per_atom?: number | null;
  best_structure_tag?: string | null;
}

export interface RunLogsResponse {
  exp_id: string;
  stdout_lines: string[];
  stderr_lines: string[];
  total_stdout_lines: number;
  total_stderr_lines: number;
}

export interface ExperimentTelemetry {
  exp_id: string;
  name?: string | null;
  process: RunStatusResponse;
  population: PopulationBreakdown;
  logs: RunLogsResponse;
  updated_at: string;
}

export interface SpaceGroupInfo {
  symbol: string;
  number: number;
  hall_symbol?: string | null;
}

export interface LatticeParameters {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
  volume: number;
  matrix: number[][];
}

export interface AtomSite {
  element: string;
  atomic_number: number;
  cart_coords: number[];
  frac_coords: number[];
  label?: string | null;
}

export interface ParsedStructure {
  tag: string;
  dir_name: string;
  generation: number;
  id_number: number;
  index: number;
  rank?: number | null;
  formula: string;
  reduced_formula: string;
  num_atoms: number;
  composition: Record<string, number>;
  energy?: number | null;
  enthalpy?: number | null;
  enthalpy_per_atom?: number | null;
  dist_above_hull?: number | null;
  pareto_front?: number | null;
  volume: number;
  volume_per_atom: number;
  density?: number | null;
  space_group?: SpaceGroupInfo | null;
  lattice?: LatticeParameters | null;
  atoms: AtomSite[];
  status: string;
  parents?: string | null;
  cif?: string | null;
}

export interface ExperimentStructuresSummary {
  exp_id: string;
  total_candidates: number;
  optimized_count: number;
  structures: ParsedStructure[];
}

// =============================================================================
// Part 4: Crystallography, Battery Capacity & XRD Diffraction Types
// =============================================================================

export interface BondLengthStats {
  pair: string;
  min_dist: number;
  max_dist: number;
  mean_dist: number;
  count: number;
}

export interface CoordinationSite {
  index: number;
  element: string;
  label: string;
  coordination_number: number;
  coordinating_elements: Record<string, number>;
  mean_distance: number;
}

export interface XRDPak {
  two_theta: number;
  intensity: number;
  hkl: string;
  d_spacing: number;
}

export interface BatteryMetrics {
  formula: string;
  molar_mass: number;
  num_li: number;
  theoretical_capacity_mah_g: number;
  theoretical_insertion_capacity_mah_g?: number | null;
  notes?: string | null;
}

export interface StructureAnalysisResult {
  exp_id: string;
  struct_id: string;
  tag: string;
  formula: string;
  reduced_formula: string;
  num_atoms: number;
  space_group: SpaceGroupInfo;
  crystal_system: string;
  lattice: LatticeParameters;
  volume: number;
  density: number;
  cif_standardized: string;
  cif_primitive?: string | null;
  cif_conventional?: string | null;
  poscar: string;
  atoms: AtomSite[];
  bond_analysis: BondLengthStats[];
  coordination_summary: CoordinationSite[];
  xrd_peaks: XRDPak[];
  battery_metrics: BatteryMetrics;
}
