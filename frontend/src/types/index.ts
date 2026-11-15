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
