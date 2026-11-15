import type {
  Preset,
  ExperimentItem,
  ExperimentCreatePayload,
  ExperimentTelemetry,
  ExperimentStructuresSummary,
  ParsedStructure,
  StructureAnalysisResult,
} from '../types';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Failed to reach backend health endpoint');
  return res.json();
}

// =============================================================================
// Presets
// =============================================================================

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

// =============================================================================
// Experiments & Runs
// =============================================================================

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

// =============================================================================
// Live Telemetry & Real-Time Monitoring (Part 3)
// =============================================================================

export async function fetchExperimentTelemetry(expId: string): Promise<ExperimentTelemetry> {
  const res = await fetch(`${API_BASE}/api/experiments/${expId}/status`);
  if (!res.ok) throw new Error(`Failed to fetch telemetry for ${expId}`);
  return res.json();
}

export async function fetchExperimentStructures(
  expId: string,
  symprec: number = 0.01
): Promise<ExperimentStructuresSummary> {
  const res = await fetch(`${API_BASE}/api/experiments/${expId}/structures?symprec=${symprec}`);
  if (!res.ok) throw new Error(`Failed to fetch structures for ${expId}`);
  return res.json();
}

export async function fetchSingleStructure(
  expId: string,
  tag: string,
  symprec: number = 0.01
): Promise<ParsedStructure> {
  const res = await fetch(`${API_BASE}/api/runs/${expId}/structures/${tag}?symprec=${symprec}`);
  if (!res.ok) throw new Error(`Failed to fetch structure ${tag} for ${expId}`);
  return res.json();
}

/**
 * Stream live telemetry via SSE or WebSocket with fallback to HTTP polling.
 * Returns an unsubscribe cleanup callback.
 */
export function subscribeExperimentTelemetry(
  expId: string,
  onData: (data: ExperimentTelemetry) => void,
  onError?: (err: any) => void
): () => void {
  let isClosed = false;
  let eventSource: EventSource | null = null;
  let ws: WebSocket | null = null;
  let pollInterval: any = null;

  const startPolling = () => {
    if (isClosed || pollInterval) return;
    const tick = async () => {
      try {
        const data = await fetchExperimentTelemetry(expId);
        if (!isClosed) onData(data);
      } catch (err) {
        if (onError && !isClosed) onError(err);
      }
    };
    tick();
    pollInterval = setInterval(tick, 2000);
  };

  // 1. Try WebSocket first
  try {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = API_BASE.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${host}/ws/experiments/${expId}`;

    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      if (isClosed) return;
      try {
        const data: ExperimentTelemetry = JSON.parse(event.data);
        onData(data);
      } catch (err) {
        console.error('Failed to parse WS telemetry message', err);
      }
    };

    ws.onerror = () => {
      if (isClosed) return;
      // Fallback to SSE
      if (ws) {
        try { ws.close(); } catch {}
        ws = null;
      }
      startSSE();
    };

    ws.onclose = () => {
      if (!isClosed && !eventSource && !pollInterval) {
        startSSE();
      }
    };
  } catch {
    startSSE();
  }

  // 2. Try Server-Sent Events (SSE) fallback
  function startSSE() {
    if (isClosed || eventSource) return;
    try {
      const sseUrl = `${API_BASE}/api/experiments/${expId}/stream`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        if (isClosed) return;
        try {
          const data: ExperimentTelemetry = JSON.parse(event.data);
          onData(data);
        } catch (err) {
          console.error('Failed to parse SSE telemetry data', err);
        }
      };

      eventSource.onerror = (err) => {
        if (isClosed) return;
        if (eventSource) {
          try { eventSource.close(); } catch {}
          eventSource = null;
        }
        startPolling();
        if (onError) onError(err);
      };
    } catch {
      startPolling();
    }
  }

  // Cleanup function
  return () => {
    isClosed = true;
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
    if (eventSource) {
      try { eventSource.close(); } catch {}
      eventSource = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}

// =============================================================================
// Part 4: Crystal & Battery Analysis API
// =============================================================================

export async function fetchStructureAnalysis(
  expId: string,
  structId: string,
  symprec: number = 0.01
): Promise<StructureAnalysisResult> {
  const res = await fetch(
    `${API_BASE}/api/experiments/${expId}/structures/${structId}/analysis?symprec=${symprec}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch analysis for structure ${structId}`);
  }
  return res.json();
}

