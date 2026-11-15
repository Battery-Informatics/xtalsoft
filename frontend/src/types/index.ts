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
