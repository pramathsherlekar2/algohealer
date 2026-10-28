export interface TransformerDiagnosis {
  source: 'gemini' | 'demo';
  model: string | null;
  diagnosis: string;
  evidenceLogIds: string[];
  evidence: TransformerLog[];
  confidence: 'low' | 'medium' | 'high';
  confidenceExplanation: string;
  recommendedAction: string | null;
  actionReason: string;
  sourceMessage?: string;
}

export interface CanaryCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface TransformerCanary {
  actionId: string;
  passed: boolean;
  tests: CanaryCheck[];
  completedAt: string;
  mode: string;
}

export interface TransformerLog {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  incidentId: string | null;
  message: string;
  code?: string;
  schemaVersion?: number | null;
  latencyMs?: number;
}

export interface TransformerAuditEvent {
  id: string;
  incidentId: string | null;
  node: string;
  event: string;
  result: string;
  timestamp: string;
  timestampEpoch: number;
  durationSeconds?: number;
  actionId?: string;
  source?: string;
  passed?: boolean;
}

export interface TransformerMetrics {
  requests: number;
  successes: number;
  errors: number;
  totalLatencyMs: number;
  lastLatencyMs: number | null;
  injectedIncidents: number;
  recoveredIncidents: number;
  rejectedIncidents: number;
  lastRecoverySeconds: number | null;
  avgLatencyMs: number | null;
}

export interface TransformerIncident {
  id: string;
  node: string;
  status: 'active' | 'rejected' | 'recovered';
  startedAt: string;
  startedAtEpoch: number;
  repairAction: string;
  recoveredAt?: string;
  recoverySeconds?: number;
}

export interface LiveBackendStatus {
  transformer: {
    healthy: boolean;
    faultActive: boolean;
    normalizerEnabled: boolean;
    incident: TransformerIncident | null;
    diagnosis: TransformerDiagnosis | null;
    canary: TransformerCanary | null;
    metrics: TransformerMetrics;
    logs: TransformerLog[];
    audit: TransformerAuditEvent[];
  };
  demoServices: {
    ingestion: { label: 'DEMO DATA'; healthy: boolean };
    database: { label: 'DEMO DATA'; healthy: boolean };
  };
}

export interface FaultInjectionResponse extends LiveBackendStatus {
  processResult: {
    statusCode: number;
    body: { ok: boolean; error?: string; message?: string; latencyMs: number };
  };
}

export interface DiagnosisResponse {
  diagnosis: TransformerDiagnosis;
  status: LiveBackendStatus;
}

export interface CanaryResponse {
  ok: boolean;
  canary: TransformerCanary;
  status: LiveBackendStatus;
}

export interface RepairResponse {
  ok: boolean;
  error?: string;
  recoverySeconds?: number;
  verification?: { ok: boolean; output?: unknown; latencyMs?: number };
  status?: LiveBackendStatus;
}

export interface ResetResponse extends LiveBackendStatus {}
