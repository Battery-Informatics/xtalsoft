import type { Preset, ExperimentItem, ExperimentCreatePayload } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Failed to reach backend health endpoint');
  return res.json();
}

// Presets
export async function fetchPresets(): Promise<Preset[]> {
  const res = await fetch(`${API_BASE}/api/presets`);
  if (!res.ok) throw new Error('Failed to fetch presets');
  return res.json();
}

export async function createPreset(preset: Partial<Preset>): Promise<Preset> {
  const res = await fetch(`${API_BASE}/api/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save preset');
  }
  return res.json();
}

export async function updatePreset(id: string, preset: Partial<Preset>): Promise<Preset> {
  const res = await fetch(`${API_BASE}/api/presets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!res.ok) throw new Error('Failed to update preset');
  return res.json();
}

export async function deletePreset(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/presets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete preset');
}

export async function clonePreset(id: string): Promise<Preset> {
  const res = await fetch(`${API_BASE}/api/presets/${id}/clone`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to clone preset');
  return res.json();
}

// Experiments & Runs
export async function fetchExperiments(): Promise<ExperimentItem[]> {
  const res = await fetch(`${API_BASE}/api/experiments`);
  if (!res.ok) throw new Error('Failed to fetch experiments');
  return res.json();
}

export async function createExperiment(payload: ExperimentCreatePayload) {
  const res = await fetch(`${API_BASE}/api/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create experiment');
  }
  return res.json();
}

export async function stopExperiment(expId: string) {
  const res = await fetch(`${API_BASE}/api/experiments/${expId}/stop`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to stop experiment ${expId}`);
  return res.json();
}

export async function fetchRunStatus(expId: string) {
  const res = await fetch(`${API_BASE}/api/runs/${expId}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function fetchRunLogs(expId: string, tail: number = 200) {
  const res = await fetch(`${API_BASE}/api/runs/${expId}/logs?tail=${tail}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function previewXtaloptIn(configPayload: any): Promise<string> {
  const res = await fetch(`${API_BASE}/api/experiments/preview-xtalopt-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configPayload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate preview');
  }
  const data = await res.json();
  return data.content;
}
