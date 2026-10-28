/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LiveTransformerPanel from './LiveTransformerPanel';
import { ApiError, apiRequest } from './api';
import type { CanaryResponse, DiagnosisResponse, FaultInjectionResponse, LiveBackendStatus, RepairResponse } from './liveTypes';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Terminal,
  Cpu,
  Database,
  Server,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  Download,
  Code2,
  GitCompare,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  Loader2,
  Sliders
} from 'lucide-react';

// ==============================================================================
// TYPES & DATA STRUCTURES
// ==============================================================================
interface NodeProfile {
  name: string;
  pod: string;
  error_type: string;
  mutation_signature: string;
  mutation_event: string;
  ticket_id: string;
  os_core_impact: string[];
  backend_impact: string;
  remediation_vector: string[];
  traceback: string;
  failed_payload: Record<string, any>;
  proposed_patch: Record<string, any>;
  diagnosis: string;
  failure_mode: string;
  remediation: string;
  similar_incidents: Array<{
    incident_id: string;
    time_ago: string;
    cosine_similarity: number;
    root_cause: string;
  }>;
}

interface ActiveFaultInstance {
  incident_id: string;
  node_key: string;
  timestamp: string;
  profile: NodeProfile;
  source?: 'live' | 'demo';
}

interface AuditEntry {
  id: string;
  node: string;
  timestamp_epoch: number;
  duration: string;
  result: string;
  status: string;
  source?: 'live' | 'demo';
}

function formatTimeElapsed(epoch: number): string {
  const delta = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
  if (delta < 15) return 'Just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) {
    const mins = Math.floor(delta / 60);
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  }
  if (delta < 86400) {
    const hours = Math.floor(delta / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(delta / 86400);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  text: string;
}

// ==============================================================================
// INDEPENDENT EXCEPTION ROUTING PROFILES
// ==============================================================================
const NODE_PROFILES: Record<string, NodeProfile> = {
  ingress: {
    name: "Ingestion API Gateway",
    pod: "ingress-gw-4b82",
    error_type: "requests.exceptions.HTTPError: 401 Unauthorized: Invalid HMAC-SHA256 signature",
    mutation_signature: "[STRIP_AUTH_HEADER]",
    mutation_event: "STRIP_AUTH_HEADER",
    ticket_id: "INC-2026-X8F2D-AUTH",
    os_core_impact: [
      "Invalidation of active Redis JWT validation cache tables (TTL evicted on cluster node auth-worker-01).",
      "Upstream client dropped packet streams at proxy gateway boundary due to expired HMAC-SHA256 signature hash.",
      "Memory buffer starvation on ingress socket listeners (/v2/stream/ingest HTTP 401 Unauthorized cascade)."
    ],
    backend_impact: "Invalidated JWT validation lifecycle cache tables in memory; dropped packet streams at gateway boundary layer (HTTP 401 unauthorized cascade across upstream proxies).",
    remediation_vector: [
      "1. algohealer-cli auth --revoke-expired-claims --client-id=10.244.3.11",
      "2. vault kv get secret/cluster-master-jwt | openssl dgst -sha256 -hmac -key-sign",
      "3. kubectl exec -n ingress ingress-gw-4b82 -- /app/bin/hot-reload-tokens --apply",
      "4. curl -I -H 'Authorization: Bearer <VERIFIED_2026_SIG>' http://127.0.0.1:8080/healthz -> 200 OK"
    ],
    traceback: `Traceback (most recent call last):
  File "/var/app/ingress/gateway.py", line 94, in verify_jwt_signature
    response.raise_for_status()
  File "/usr/lib/python3.10/requests/models.py", line 1021, in raise_for_status
    raise HTTPError("401 Client Error: Bearer token signature HMAC expired or invalid header", response=self)
requests.exceptions.HTTPError: 401 Unauthorized: Invalid HMAC-SHA256 signature`,
    failed_payload: {
      endpoint: "/v2/stream/ingest",
      auth_header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired_signature",
      client_ip: "10.244.3.11",
      status: 401
    },
    proposed_patch: {
      endpoint: "/v2/stream/ingest",
      auth_header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.verified_active_sig_2026",
      client_ip: "10.244.3.11",
      token_renewed: true,
      handshake_verified: "AlgoHealer_AuthGuard"
    },
    diagnosis: "Ingress Gateway authentication crash due to an expired OAuth 2.0 Bearer JWT signature HMAC token in upstream request header.",
    failure_mode: "Upstream client supplied signature from invalidated key rotation cycle, triggering requests.exceptions.HTTPError: 401 Unauthorized at line 94 of gateway.py.",
    remediation: "Autonomous token re-signing with active cluster master key, refreshing cryptographic bearer claims.",
    similar_incidents: [
      { incident_id: "INC-2026-8911", time_ago: "2 days ago", cosine_similarity: 95.1, root_cause: "Expired HMAC Bearer signature rejected by Ingress proxy" },
      { incident_id: "INC-2026-8402", time_ago: "11 days ago", cosine_similarity: 87.4, root_cause: "Clock skew invalidation in OAuth 2.0 handshake" }
    ]
  },
  transformer: {
    name: "Data Transformer Node",
    pod: "transformer-worker-v2",
    error_type: "json.decoder.JSONDecodeError: Unterminated string starting at line 1 column 47",
    mutation_signature: "[TRUNCATE_BYTE_STREAM]",
    mutation_event: "TRUNCATE_BYTE_STREAM",
    ticket_id: "INC-2026-T409B-JSON",
    os_core_impact: [
      "Deserialization parser stack overflow on unquoted byte stream buffer offset 47.",
      "Worker thread stalled in heap memory contention waiting on terminating double-quote delimiter.",
      "Truncated chunk dropped from live stream ingestion pipeline, blocking downstream ETL transformer workers."
    ],
    backend_impact: "Parser stack overflow on unquoted byte stream offset 47; worker deserialization worker thread stalled in heap with memory contention (JSONDecodeError unhandled abort).",
    remediation_vector: [
      "1. algohealer-cli pipeline pause-ingress --node=transformer-worker-v2",
      "2. py-ast-transpile --strict-rfc8259 --quote-unquoted-literals /var/app/transformer/worker.py",
      "3. injection-sandbox --mount-patch /tmp/patch_sanitized.json --test-ast",
      "4. kubectl rollout restart deployment/transformer-worker --namespace=production"
    ],
    traceback: `Traceback (most recent call last):
  File "/var/app/transformer/worker.py", line 184, in process_stream
    validated_record = json.loads(raw_json_chunk)
  File "/usr/lib/python3.10/json/__init__.py", line 346, in loads
    return _default_decoder.decode(s)
  File "/usr/lib/python3.10/json/decoder.py", line 337, in decode
    obj, end = self.raw_decode(s, idx=_w(s, 0).end())
  File "/usr/lib/python3.10/json/decoder.py", line 355, in raw_decode
    raise JSONDecodeError("Unterminated string starting at", s, err.value) from None
json.decoder.JSONDecodeError: Unterminated string starting at line 1 column 47`,
    failed_payload: {
      tenant_uuid: "00000000-0000-0000-0000-000000000000",
      customer_id: "CUST-40912",
      transaction_val: 1850.50,
      currency: "USD",
      metadata_raw: "{invalid_unquoted_token: true"
    },
    proposed_patch: {
      tenant_uuid: "00000000-0000-0000-0000-000000000000",
      customer_id: "CUST-40912",
      transaction_val: 1850.50,
      currency: "USD",
      timestamp: "2026-10-27T23:00:00Z",
      metadata_raw: '{"token_state": "sanitized", "normalized_by": "AlgoHealer_ZeroShot_Agent", "recovered": true}'
    },
    diagnosis: "Fatal JSON syntax parser crash caused by an unescaped, unquoted token inside metadata_raw truncating the byte stream at line 1 column 47.",
    failure_mode: "Upstream serialization emitted unquoted literal token '{invalid_unquoted_token: true' without terminating quotes, causing Python's json.decoder to abort with Unterminated string starting at line 1 column 47 at line 184 of worker.py.",
    remediation: "Sanitize and quote malformed metadata tokens into compliant RFC 8259 JSON structure, inject verified timestamp envelope, and resume transformer stream.",
    similar_incidents: [
      { incident_id: "INC-2026-9042", time_ago: "3 days ago", cosine_similarity: 94.2, root_cause: "Unescaped unquoted token truncated serialization stream at byte offset 47" },
      { incident_id: "INC-2026-8819", time_ago: "9 days ago", cosine_similarity: 88.7, root_cause: "Unquoted JSON string payload from legacy gateway truncated buffer" }
    ]
  },
  database: {
    name: "Production Database",
    pod: "aurora-pg-qdrant-cluster",
    error_type: "qdrant_client.errors.UnexpectedResponse: Vector dimension mismatch (expected 1536, got 768)",
    mutation_signature: "[VECTOR_DIM_MISMATCH]",
    mutation_event: "VECTOR_DIM_MISMATCH",
    ticket_id: "INC-2026-Q412E-DB",
    os_core_impact: [
      "Vector HNSW index memory page corruption caused by 768d vs 1536d projection collision.",
      "Qdrant storage ring-buffer stalled with UnexpectedResponse: 400 Bad Request dimension fault.",
      "Transactional commit deadlock on /data/qdrant/storage/wal, forcing WAL replay rollback."
    ],
    backend_impact: "Vector HNSW index memory page corrupted by 768d vs 1536d projection collision; throttled transactional commit ring-buffer and stalled ingestion queues.",
    remediation_vector: [
      "1. qdrant-admin collections --name=telemetry_traces inspect --lock-writes",
      "2. vector-adapter --project 768 -> 1536 --model=text-embedding-3-large --reconcile",
      "3. hnsw-index-rebuild --threads=8 --verify-integrity /data/qdrant/storage/wal",
      "4. qdrant-admin collections --name=telemetry_traces unlock-writes --resume-stream"
    ],
    traceback: `Traceback (most recent call last):
  File "/var/app/db/vector_client.py", line 92, in upsert_points
    client.upsert(collection_name="telemetry_traces", points=batch)
  File "/usr/local/lib/python3.10/dist-packages/qdrant_client/qdrant_client.py", line 412, in upsert
    raise UnexpectedResponse(400, "Vector dimension mismatch: index expects dense 1536d, received 768d")
qdrant_client.errors.UnexpectedResponse: Vector dimension mismatch in collection 'telemetry_traces': expected 1536, got 768`,
    failed_payload: {
      collection: "telemetry_traces",
      vector_dim: 768,
      expected_dim: 1536,
      embedding_model: "text-embedding-ada-002-legacy",
      payload_id: "vec_point_9921"
    },
    proposed_patch: {
      collection: "telemetry_traces",
      vector_dim: 1536,
      expected_dim: 1536,
      embedding_model: "text-embedding-3-large",
      payload_id: "vec_point_9921",
      projected_by: "AlgoHealer_VectorAdapter"
    },
    diagnosis: "Dense vector dimension mismatch during database upsert into Qdrant vector collection 'telemetry_traces'.",
    failure_mode: "Upstream embedding model produced deprecated 768-dimensional vectors while target HNSW index strictly requires 1536-dimensional embeddings, throwing qdrant_client.errors.UnexpectedResponse at line 92 of vector_client.py.",
    remediation: "Re-project input vector array using zero-shot dimension adapter to 1536-dim standard, synchronize schema, and flush uncommitted batch.",
    similar_incidents: [
      { incident_id: "INC-2026-8740", time_ago: "5 days ago", cosine_similarity: 96.4, root_cause: "Legacy 768d vector array passed to 1536d Qdrant collection" },
      { incident_id: "INC-2026-8119", time_ago: "14 days ago", cosine_similarity: 89.2, root_cause: "Schema drift in HNSW vector index parameter" }
    ]
  }
};

const DEMO_AUDIT_LOG: AuditEntry[] = [
  { id: 'DEMO-9042-TRNS', node: 'Data Transformer Node', timestamp_epoch: Date.now() - 14 * 60 * 1000, duration: 'sample', result: 'Sample historical event', status: 'DEMO DATA', source: 'demo' },
  { id: 'DEMO-8911-INGR', node: 'Ingestion API Gateway', timestamp_epoch: Date.now() - 74 * 60 * 1000, duration: 'sample', result: 'Sample historical event', status: 'DEMO DATA', source: 'demo' },
  { id: 'DEMO-8740-DB01', node: 'Production Database', timestamp_epoch: Date.now() - 190 * 60 * 1000, duration: 'sample', result: 'Sample historical event', status: 'DEMO DATA', source: 'demo' },
];

export default function App() {
  // Authentication Gateway State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');

  // Multi-Terminal Chaos Matrix Selection State
  const [chaosSelection, setChaosSelection] = useState<Record<string, boolean>>({
    ingress: false,
    transformer: true,
    database: false
  });

  // Active Faults dictionary: nodeKey -> ActiveFaultInstance
  const [activeFaults, setActiveFaults] = useState<Record<string, ActiveFaultInstance>>({});
  const [selectedInspectorNode, setSelectedInspectorNode] = useState<string>('transformer');

  // Global UI States
  const [mttrDisplay, setMttrDisplay] = useState<string>('—');
  const [currentStage, setCurrentStage] = useState<'NOMINAL' | 'FAULT_ACTIVE'>('NOMINAL');
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  // Snapshot Alert & Canary Sandbox States
  const [snapshotAlert, setSnapshotAlert] = useState<string | null>(null);
  const [canaryRunning, setCanaryRunning] = useState<boolean>(false);
  const [canaryProgress, setCanaryProgress] = useState<number>(0);
  const [canaryLogs, setCanaryLogs] = useState<string[]>([]);
  const [canaryPassed, setCanaryPassed] = useState<boolean>(false);

  // Multi-Stage Recovery Sequence State
  const [recoveryRunning, setRecoveryRunning] = useState<boolean>(false);
  const [recoveryStage, setRecoveryStage] = useState<number>(0);
  const [recoveryMessages, setRecoveryMessages] = useState<string[]>([]);

  // Live state is served only by the local API. Ingestion and database remain demo nodes.
  const [liveBackend, setLiveBackend] = useState<LiveBackendStatus | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [backendBusy, setBackendBusy] = useState<boolean>(false);
  const [diagnosisBusy, setDiagnosisBusy] = useState<boolean>(false);
  const [liveCanaryRunning, setLiveCanaryRunning] = useState<boolean>(false);

  // Historical Audit Trail with Dynamic Real-Time Time-Elapsed Tracking
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(DEMO_AUDIT_LOG);

  // Tab & Code View
  const [activeTab, setActiveTab] = useState<'console' | 'code_viewer'>('console');
  const [streamlitCode, setStreamlitCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  // Load app.py for code viewer
  useEffect(() => {
    fetch('/app.py')
      .then(res => res.text())
      .then(text => {
        if (text && text.includes('AlgoHealer')) {
          setStreamlitCode(text);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshLiveStatus = async () => {
      try {
        const status = await apiRequest<LiveBackendStatus>('/api/status');
        if (!mounted) return;
        setLiveBackend(status);
        setApiError(null);
        setMttrDisplay(status.transformer.metrics.lastRecoverySeconds === null
          ? '—'
          : `${status.transformer.metrics.lastRecoverySeconds}s`);
        const liveAudit: AuditEntry[] = status.transformer.audit.map((event) => ({
          id: event.incidentId ?? event.id,
          node: event.node,
          timestamp_epoch: event.timestampEpoch,
          duration: event.durationSeconds === undefined ? '—' : `${event.durationSeconds}s`,
          result: event.result,
          status: `LIVE · ${event.event.replaceAll('_', ' ')}`,
          source: 'live',
        }));
        setAuditLog([...liveAudit, ...DEMO_AUDIT_LOG]);
        setActiveFaults((previous) => {
          if (status.transformer.faultActive && status.transformer.incident) {
            return {
              ...previous,
              transformer: {
                incident_id: status.transformer.incident.id,
                node_key: 'transformer',
                timestamp: status.transformer.incident.startedAt,
                profile: NODE_PROFILES.transformer,
                source: 'live',
              },
            };
          }
          if (previous.transformer?.source === 'live') {
            const next = { ...previous };
            delete next.transformer;
            return next;
          }
          return previous;
        });
      } catch {
        if (mounted) setApiError('Local API unavailable. Start `npm run backend` in a second terminal.');
      }
    };

    void refreshLiveStatus();
    const pollId = window.setInterval(() => void refreshLiveStatus(), 1500);
    return () => {
      mounted = false;
      window.clearInterval(pollId);
    };
  }, []);

  // 1. Strict Authentication Form Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim() === 'admin' && passwordInput === 'algohealer2026') {
      setIsAuthenticated(true);
      setAuthEmail('admin · demo');
      setAuthError(null);
    } else {
      setAuthError('Access Denied: Invalid credentials. Verification rejected.');
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUsernameInput('');
    setPasswordInput('');
    setAuthError(null);
    setActiveFaults({});
    setCanaryPassed(false);
    setCanaryLogs([]);
    setRecoveryRunning(false);
  };

  const analyzeLiveIncident = async () => {
    setDiagnosisBusy(true);
    setApiError(null);
    try {
      const response = await apiRequest<DiagnosisResponse>('/api/diagnose', 'POST', {});
      setLiveBackend(response.status);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Incident analysis failed.');
    } finally {
      setDiagnosisBusy(false);
    }
  };

  // 2. Inject a real local transformer fault; other selected nodes remain labeled demo simulations.
  const deployFaults = async (selectedKeys: string[]) => {
    if (selectedKeys.length === 0) return;
    setBackendBusy(true);
    setApiError(null);
    try {
      let transformerStatus: LiveBackendStatus | null = null;
      if (selectedKeys.includes('transformer')) {
        transformerStatus = await apiRequest<FaultInjectionResponse>('/api/faults/transformer', 'POST', {});
        setLiveBackend(transformerStatus);
      }

      const newFaults: Record<string, ActiveFaultInstance> = {};
      selectedKeys.forEach((key) => {
        const incident = key === 'transformer' ? transformerStatus?.transformer.incident : null;
        newFaults[key] = {
          incident_id: incident?.id ?? `DEMO-${Math.floor(1000 + Math.random() * 9000)}-${key.substring(0, 4).toUpperCase()}`,
          node_key: key,
          timestamp: incident?.startedAt ?? new Date().toISOString(),
          profile: NODE_PROFILES[key],
          source: key === 'transformer' ? 'live' : 'demo',
        };
      });

      setActiveFaults((previous) => ({ ...previous, ...newFaults }));
      setSelectedInspectorNode(selectedKeys[0]);
      setMttrDisplay('—');
      setSnapshotAlert(null);
      setCurrentStage('FAULT_ACTIVE');
      setRejectionMessage(null);
      setCanaryPassed(false);
      setCanaryLogs([]);
      if (selectedKeys.includes('transformer')) void analyzeLiveIncident();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not inject the local transformer fault.');
    } finally {
      setBackendBusy(false);
    }
  };

  const handleDeployFaultPipeline = () => {
    void deployFaults(Object.keys(chaosSelection).filter((key) => chaosSelection[key]));
  };

  // 3. The transformer runs real local checks. Remaining node flows are visibly demo-only.
  const handleRunCanaryTest = async (nodeOverride?: string) => {
    const targetNodeKey = nodeOverride ?? selectedInspectorNode;
    if (targetNodeKey === 'transformer') {
      if (!liveBackend?.transformer.faultActive) {
        setApiError('Inject a transformer fault before running its canary.');
        return;
      }
      setLiveCanaryRunning(true);
      setCanaryLogs(['Running the local transformer compatibility checks…']);
      setApiError(null);
      try {
        const response = await apiRequest<CanaryResponse>('/api/canary', 'POST', {});
        setLiveBackend(response.status);
        setCanaryPassed(response.canary.passed);
        setCanaryLogs(response.canary.tests.map((check) => `${check.passed ? '[PASS]' : '[FAIL]'} ${check.name}: ${check.detail}`));
      } catch (error) {
        setCanaryPassed(false);
        setApiError(error instanceof Error ? error.message : 'Transformer canary failed.');
      } finally {
        setLiveCanaryRunning(false);
      }
      return;
    }

    const targetNodeName = activeFaults[targetNodeKey]?.profile.name || 'Demo node';
    setCanaryRunning(true);
    setCanaryProgress(10);
    setCanaryLogs([`[DEMO] Starting simulated canary sequence for ${targetNodeName}.`]);
    setTimeout(() => setCanaryProgress(35), 350);
    setTimeout(() => setCanaryProgress(70), 750);
    setTimeout(() => setCanaryProgress(90), 1150);
    setTimeout(() => {
      setCanaryProgress(100);
      setCanaryRunning(false);
      setCanaryPassed(true);
      setCanaryLogs((previous) => [...previous, '[DEMO] Simulated checks completed. No live service was tested.']);
    }, 1500);
  };

  // 4. Apply the allow-listed backend repair only after the real transformer canary passes.
  const handleApprovePatch = async (nodeOverride?: string) => {
    const targetNodeKey = nodeOverride ?? selectedInspectorNode;
    if (targetNodeKey === 'transformer') {
      if (!liveBackend?.transformer.faultActive) {
        setApiError('There is no active live transformer incident to approve.');
        return;
      }
      setBackendBusy(true);
      setRecoveryRunning(true);
      setApiError(null);
      try {
        const response = await apiRequest<RepairResponse>('/api/approve', 'POST', {});
        if (response.status) setLiveBackend(response.status);
        const recoverySeconds = response.recoverySeconds ?? response.status?.transformer.metrics.lastRecoverySeconds ?? 0;
        setMttrDisplay(`${recoverySeconds}s`);
        setSnapshotAlert(`Allow-listed schema normalizer restored and verified by the local service in ${recoverySeconds}s.`);
        setCurrentStage(Object.keys(activeFaults).some((key) => key !== 'transformer') ? 'FAULT_ACTIVE' : 'NOMINAL');
        setRejectionMessage(null);
        setCanaryPassed(false);
        setCanaryLogs([]);
        setActiveFaults((previous) => {
          const next = { ...previous };
          if (next.transformer?.source === 'live') delete next.transformer;
          return next;
        });
      } catch (error) {
        if (error instanceof ApiError && typeof error.payload === 'object' && error.payload !== null && 'status' in error.payload) {
          const payload = error.payload as RepairResponse;
          if (payload.status) setLiveBackend(payload.status);
        }
        setApiError(error instanceof Error ? error.message : 'Repair approval failed.');
      } finally {
        setRecoveryRunning(false);
        setBackendBusy(false);
      }
      return;
    }

    const activeKeys = Object.keys(activeFaults).filter((key) => key !== 'transformer');
    if (activeKeys.length === 0) return;

    setRecoveryRunning(true);
    setRecoveryStage(1);
    setRecoveryMessages([
      '[DEMO] 1/4: Recording a simulated pre-execution snapshot...'
    ]);

    setTimeout(() => {
      setRecoveryStage(2);
      setRecoveryMessages(prev => [
        ...prev,
        `[DEMO] 2/4: Simulating a patch across ${activeKeys.length} demo node(s)...`
      ]);
    }, 550);

    setTimeout(() => {
      setRecoveryStage(3);
      setRecoveryMessages(prev => [
        ...prev,
        '[DEMO] 3/4: Simulating pipeline verification...'
      ]);
    }, 1100);

    setTimeout(() => {
      setRecoveryStage(4);
      setRecoveryMessages(prev => [
        ...prev,
        '[DEMO] 4/4: Updating the local demo audit history...'
      ]);
    }, 1600);

    setTimeout(() => {
      const generatedHash = '0x' + Math.random().toString(16).substring(2, 10) + 'a8e';
      setRecoveryRunning(false);
      setMttrDisplay('Demo');

      // REAL-TIME TIME-ELAPSED STREAMING: Dynamically capture current epoch and prepend
      const now = Date.now();
      const newEntries: AuditEntry[] = activeKeys.map(k => {
        const durationFloat = (11.0 + Math.random() * 1.85).toFixed(2);
        return {
          id: activeFaults[k].incident_id,
          node: activeFaults[k].profile.name,
          timestamp_epoch: now,
          duration: `${durationFloat}s`,
          result: '[DEMO] Simulated patch flow',
          status: 'DEMO DATA',
          source: 'demo'
        };
      });

      // Prepend to audit log
      setAuditLog(prev => [...newEntries, ...prev]);
      setSnapshotAlert(
        `[DEMO] Simulated recovery sequence completed (${generatedHash}). Other nodes are not connected to live services.`
      );

      setCurrentStage('NOMINAL');
      setRejectionMessage(null);
      setActiveFaults((previous) => {
        const next = { ...previous };
        activeKeys.forEach((key) => delete next[key]);
        return next;
      });
      setCanaryPassed(false);
      setCanaryLogs([]);
    }, 2100);
  };

  // A transformer rejection is recorded by the backend and leaves its fault active.
  const handleRejectPatch = async (nodeOverride?: string) => {
    const targetNodeKey = nodeOverride ?? selectedInspectorNode;
    if (targetNodeKey === 'transformer') {
      setBackendBusy(true);
      setApiError(null);
      try {
        const response = await apiRequest<{ ok: boolean; status: LiveBackendStatus }>('/api/reject', 'POST', {});
        setLiveBackend(response.status);
        setCurrentStage('FAULT_ACTIVE');
        setCanaryPassed(false);
        setCanaryLogs([]);
        setRejectionMessage('Operator rejected the fixed repair. The local transformer remains faulted; run canary and approve a repair, or reset the demo.');
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Could not record repair rejection.');
      } finally {
        setBackendBusy(false);
      }
      return;
    }

    setCurrentStage('FAULT_ACTIVE');
    setCanaryPassed(false);
    setCanaryLogs([]);
    setRejectionMessage(
      '[DEMO] Operator rejected the simulated patch. Demo node state remains impaired.'
    );
  };

  const handleResetDemo = async () => {
    setBackendBusy(true);
    setApiError(null);
    try {
      const status = await apiRequest<LiveBackendStatus>('/api/reset', 'POST', {});
      setLiveBackend(status);
      setActiveFaults({});
      setAuditLog(DEMO_AUDIT_LOG);
      setSelectedInspectorNode('transformer');
      setMttrDisplay('—');
      setSnapshotAlert(null);
      setRejectionMessage(null);
      setCanaryPassed(false);
      setCanaryLogs([]);
      setCurrentStage('NOMINAL');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not reset the local demo.');
    } finally {
      setBackendBusy(false);
    }
  };

  // The transformer is live; ingress and database states are local demo toggles.
  const transformerFaultActive = Boolean(liveBackend?.transformer.faultActive || activeFaults.transformer);
  const totalNodes = 3;
  const failedNodesCount = Number(transformerFaultActive) + Number(Boolean(activeFaults.ingress)) + Number(Boolean(activeFaults.database));
  const isClusterHealthy = failedNodesCount === 0 && currentStage !== 'FAULT_ACTIVE';
  const totalIncidentsHealed = liveBackend?.transformer.metrics.recoveredIncidents ?? 0;
  const totalIncidentsFired = liveBackend?.transformer.metrics.injectedIncidents ?? 0;
  const calculatedSuccessRate = totalIncidentsFired > 0
    ? ((totalIncidentsHealed / totalIncidentsFired) * 100).toFixed(1)
    : '—';

  // Compute the cluster percentage from the live transformer plus visibly simulated nodes.
  const healthyNodesCount = totalNodes - failedNodesCount;
  const healthPercentage = ((healthyNodesCount / totalNodes) * 100).toFixed(1);

  // Active inspected fault
  const inspectedFault = activeFaults[selectedInspectorNode] || Object.values(activeFaults)[0];

  // Dynamic Diff Lines for Inspected Node
  const computeDiffLines = (): DiffLine[] => {
    if (!inspectedFault) return [];
    const failedLines = JSON.stringify(inspectedFault.profile.failed_payload, null, 2).split('\n');
    const patchLines = JSON.stringify(inspectedFault.profile.proposed_patch, null, 2).split('\n');

    const result: DiffLine[] = [];
    failedLines.forEach(fl => {
      if (!patchLines.includes(fl)) {
        result.push({ type: 'removed', text: fl.replace(/^\s*/, '-   ') });
      } else {
        result.push({ type: 'context', text: fl });
      }
    });
    patchLines.forEach(pl => {
      if (!failedLines.includes(pl)) {
        result.push({ type: 'added', text: pl.replace(/^\s*/, '+   ') });
      }
    });
    return result;
  };

  const handleCopyCode = () => {
    if (streamlitCode) {
      navigator.clipboard.writeText(streamlitCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyCrashLog = () => {
    if (inspectedFault) {
      navigator.clipboard.writeText(JSON.stringify(inspectedFault.profile.failed_payload, null, 2));
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 2000);
    }
  };

  const handleDownloadAppPy = () => {
    const blob = new Blob([streamlitCode || '# AlgoHealer Streamlit Prototype\n'], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* ==============================================================================
          TOP BAR CONTRACT (Single-row, 3 zones: Brand, Navigation links, Primary Action)
      ============================================================================== */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur-md px-6 flex items-center justify-between gap-8 shrink-0 z-30">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-4 h-4" />
          </div>
          <a href="/" className="text-base font-semibold tracking-tight text-white whitespace-nowrap">
            AlgoHealer
          </a>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-400 font-mono">Local SRE Recovery Demo</span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('console')}
            className={`transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'console' ? 'text-emerald-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            SRE Telemetry Console
          </button>
          <span className="text-slate-700">·</span>
          <button
            onClick={() => setActiveTab('code_viewer')}
            className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'code_viewer' ? 'text-emerald-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Streamlit Python Source (app.py)
          </button>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500 whitespace-nowrap">Local isolated demo</span>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-medium whitespace-nowrap">{authEmail}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2.5 py-1 rounded-md">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-medium whitespace-nowrap">Demo Sign-In Required</span>
            </div>
          )}

          {isAuthenticated && activeTab === 'console' && (
            <button
              onClick={handleDeployFaultPipeline}
              disabled={recoveryRunning || backendBusy}
              className={`px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap ${
                recoveryRunning
                  ? 'bg-rose-900/40 text-rose-400/60 cursor-not-allowed border border-rose-800/40'
                  : 'bg-rose-600 hover:bg-rose-500 cursor-pointer'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Inject Selected Local/Demo Faults
            </button>
          )}
        </div>
      </header>

      {/* ==============================================================================
          MAIN CONTAINER (Sidebar + Dashboard Viewport)
      ============================================================================== */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* ==============================================================================
            SIDEBAR: REAL AUTHENTICATION & MULTI-TERMINAL CHAOS MATRIX
        ============================================================================== */}
        <aside className="w-full md:w-72 bg-[#0c121e] border-r border-slate-800/80 p-5 flex flex-col gap-6 shrink-0 overflow-y-auto">
          
          {/* Auth Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">SRE Gateway</span>
              {isAuthenticated ? (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                  Demo session
                </span>
              ) : (
                <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded font-mono">
                  Locked
                </span>
              )}
            </div>

            {isAuthenticated ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">Demo operator signed in</span>
                    <span className="text-[11px] text-slate-400 font-mono truncate">{authEmail}</span>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-400/90 bg-emerald-950/30 border border-emerald-800/40 p-2 rounded">
                  Local demo access only. No production cluster is connected.
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 rounded bg-slate-800/40 transition-colors cursor-pointer"
                >
                  Sign Out / Lock Console
                </button>
              </div>
            ) : (
              <form onSubmit={handleLoginSubmit} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-3">
                <div className="text-xs text-slate-400 leading-relaxed">
                  Enter the local demo credentials to unlock the dashboard controls.
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-400">Username / Operator ID</label>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. admin"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-400">Password / Secret Key</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. algohealer2026"
                  />
                </div>

                {authError && (
                  <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2 rounded flex items-start gap-1.5">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full mt-1 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded transition-colors cursor-pointer"
                >
                  Verify &amp; Sign in
                </button>
              </form>
            )}
          </div>

          {/* Dynamic Multi-Terminal Fault Integrator Checklist Matrix */}
          {isAuthenticated && (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Multi-Terminal Chaos Core
              </span>
              <p className="text-[11px] text-slate-400">
                Select service terminals to target simultaneously:
              </p>

              <div className="flex flex-col gap-2 bg-slate-900/60 border border-slate-800 p-3 rounded-lg">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={chaosSelection.ingress}
                    onChange={e => setChaosSelection(prev => ({ ...prev, ingress: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Ingestion API Gateway <span className="text-[9px] text-amber-300">· DEMO</span></span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={chaosSelection.transformer}
                    onChange={e => setChaosSelection(prev => ({ ...prev, transformer: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Data Transformer Node <span className="text-[9px] text-sky-300">· LIVE LOCAL</span></span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={chaosSelection.database}
                    onChange={e => setChaosSelection(prev => ({ ...prev, database: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Production Database <span className="text-[9px] text-amber-300">· DEMO</span></span>
                </label>

                <button
                  onClick={handleDeployFaultPipeline}
                  disabled={recoveryRunning || backendBusy || !Object.values(chaosSelection).some(Boolean)}
                  className={`mt-2 py-2 px-3 rounded text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 ${
                    !Object.values(chaosSelection).some(Boolean)
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-500 cursor-pointer'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Deploy Multi-Vector Fault Injection Pipeline
                </button>
              </div>
            </div>
          )}

          {/* LOWER-LEFT FOOTER INFRASTRUCTURE STATE (ZERO RENDERING LAG) */}
          <div className="mt-auto pt-4 border-t border-slate-800/80 flex flex-col gap-2 text-xs text-slate-400">
            <div className="flex justify-between items-center">
              <span>Cluster State</span>
              {!isClusterHealthy ? (
                <span className="font-mono text-rose-400 font-bold animate-pulse">
                  💥 IMPAIRED
                </span>
              ) : (
                <span className="font-mono text-emerald-400 font-bold">
                  ✅ ACTIVE-OPTIMAL
                </span>
              )}
            </div>
            <div className="flex justify-between">
              <span>Vector Database</span>
              <span className="text-slate-300 font-mono">Qdrant v1.8</span>
            </div>
            <div className="flex justify-between">
              <span>Canary Sandbox</span>
              <span className="text-emerald-400 font-mono">Isolated</span>
            </div>
          </div>
        </aside>

        {/* ==============================================================================
            MAIN VIEWPORT
        ============================================================================== */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* ==============================================================================
              GATEWAY SCREEN (Displayed when UNVERIFIED)
          ============================================================================== */}
          {!isAuthenticated ? (
            <div className="max-w-xl mx-auto my-auto text-center bg-[#0c121e] border border-slate-800 rounded-2xl p-8 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-800/50 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/30">
                <Lock className="w-7 h-7" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  AlgoHealer Demo Sign-In Required
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                  Sign in to explore the local demo. The transformer connects to a local API; the other services are demo data.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 text-left w-full flex flex-col gap-2 font-mono">
                <div className="text-slate-400 font-sans font-semibold">Demo credentials:</div>
                <div className="flex justify-between text-slate-400">
                  <span>Username:</span>
                  <span className="text-emerald-400 font-bold">admin</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Password:</span>
                  <span className="text-emerald-400 font-bold">algohealer2026</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Enter the demo credentials in the sidebar form to open the dashboard.
              </p>
            </div>
          ) : activeTab === 'code_viewer' ? (
            /* ==============================================================================
                TAB: STREAMLIT PYTHON CODE INSPECTOR
            ============================================================================== */
            <div className="flex flex-col gap-4 max-w-5xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0c121e] p-5 rounded-xl border border-slate-800">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">app.py</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-400">Streamlit Python Single-File Prototype</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Runs natively with standard packages: <code className="text-emerald-400 font-mono">streamlit, difflib, pandas, plotly, requests</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy app.py'}
                  </button>
                  <button
                    onClick={handleDownloadAppPy}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#070b13]">
                <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400 font-mono">
                  <span>Python 3.10+ / Streamlit Script</span>
                  <span>{streamlitCode.split('\n').length} lines</span>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto">
                  {streamlitCode || '// Loading app.py content...'}
                </pre>
              </div>
            </div>
          ) : (
            /* ==============================================================================
                TAB: SRE TELEMETRY CONSOLE
            ============================================================================== */
            <>
              {/* Snapshot Alert Banner */}
              {snapshotAlert && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 flex items-start gap-3 animate-fadeIn">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-emerald-200 leading-relaxed">
                    <span className="font-semibold text-emerald-300">Autonomous Safety Guard: </span>
                    {snapshotAlert}
                  </div>
                  <button
                    onClick={() => setSnapshotAlert(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Rejection Alert Banner */}
              {rejectionMessage && (
                <div className="bg-rose-950/40 border border-rose-500/60 rounded-xl p-4 flex items-start gap-3 animate-fadeIn shadow-lg shadow-rose-950/30">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="flex-1 text-xs text-rose-200 leading-relaxed font-mono">
                    {rejectionMessage}
                  </div>
                  <button
                    onClick={() => setRejectionMessage(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* ==============================================================================
                  1. TOP KPI ANALYTICS BAR (RE-ENGINEERED MATH & RESPONSIVE COLUMN GRID)
              ============================================================================== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                
                {/* Metric 1: System Health (Dynamic Fraction of 3 Nodes) */}
                <div className={`p-4 rounded-xl border bg-[#0c121e] flex flex-col gap-1 transition-all lg:col-span-3 ${
                  !isClusterHealthy
                    ? 'border-rose-500/60 bg-rose-950/20 shadow-lg shadow-rose-950/20'
                    : 'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Pipeline Health</span>
                    {!isClusterHealthy ? (
                      <span className="text-rose-400 font-medium font-mono text-[11px]">
                        -{((failedNodesCount / totalNodes) * 100).toFixed(1)}% Impairment
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium font-mono text-[11px]">+Healthy</span>
                    )}
                  </div>
                  <div className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
                    !isClusterHealthy ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                  }`}>
                    {healthPercentage}% ({healthyNodesCount}/{totalNodes} Nodes)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {!isClusterHealthy
                      ? `${failedNodesCount} node(s) actively impaired in pipeline`
                      : 'All 3 pipeline nodes synchronized'}
                  </div>
                </div>

                {/* Metric 2: Pipeline Status Mode (Wider Column to Eliminate Truncation) */}
                <div className={`p-4 rounded-xl border bg-[#0c121e] flex flex-col gap-1 transition-all lg:col-span-4 ${
                  !isClusterHealthy ? 'border-rose-500/60 bg-rose-950/20' : 'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Pipeline Status Mode</span>
                    {!isClusterHealthy ? (
                      <span className="text-rose-400 font-mono text-[11px]">Active Impairment</span>
                    ) : (
                      <span className="text-emerald-400 font-mono text-[11px]">Synced</span>
                    )}
                  </div>
                  <div className={`text-sm sm:text-base lg:text-[15px] font-bold font-mono tracking-tight whitespace-normal break-words leading-tight ${
                    !isClusterHealthy ? 'text-rose-400' : 'text-slate-100'
                  }`}>
                    {!isClusterHealthy ? 'CRITICAL IMPAIRMENT DETECTED' : 'NOMINAL (100%)'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {!isClusterHealthy ? 'Transformer live · other nodes demo' : 'Transformer healthy · other nodes demo'}
                  </div>
                </div>

                {/* Metric 3: MTTR ("Calculating..." during active fault) */}
                <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col gap-1 lg:col-span-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>MTTR</span>
                    {!isClusterHealthy ? (
                      <span className="text-amber-400 font-mono text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" /> {transformerFaultActive ? 'Live timer' : 'Demo state'}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-mono text-[11px]">LOCAL</span>
                    )}
                  </div>
                  <div className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
                    !isClusterHealthy ? 'text-amber-300' : 'text-white'
                  }`}>
                    {!isClusterHealthy ? (transformerFaultActive ? 'Timing live incident…' : 'Demo') : mttrDisplay}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {!isClusterHealthy ? (transformerFaultActive ? 'Timer started at fault injection' : 'No live service is being timed') : 'Measured only for live transformer recoveries'}
                  </div>
                </div>

                {/* Metric 4: Measured recovery ratio for the local transformer */}
                <div className="p-4 rounded-xl border border-slate-800 bg-[#0c121e] flex flex-col gap-1 lg:col-span-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Healing Success Rate</span>
                    <span className="text-sky-300 font-mono text-[11px]">LIVE TRANSFORMER</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-emerald-400">
                    {calculatedSuccessRate === '—' ? '—' : `${calculatedSuccessRate}%`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    ({totalIncidentsHealed}/{totalIncidentsFired} live incidents recovered)
                  </div>
                </div>
              </div>

              {/* ==============================================================================
                  2. DYNAMIC DEPENDENCY GRAPH VISUALIZER (ALL 3 NODES WIRED)
              ============================================================================== */}
              <div className="bg-[#0c121e] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Service Dependency Map</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-400">Local transformer API · two demo nodes</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500" /> Live transformer
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Demo service
                    </span>
                  </div>
                </div>

                {/* Pipeline Nodes Canvas */}
                <div className="relative bg-[#070b13] border border-slate-800/80 rounded-xl p-6 min-h-[220px] flex items-center justify-between gap-4 overflow-x-auto">
                  
                  {/* Node 1: Ingestion API Gateway */}
                  {(() => {
                    const isIngressBroken = 'ingress' in activeFaults;
                    return (
                      <div
                        onClick={() => setSelectedInspectorNode('ingress')}
                        className={`flex-1 min-w-[200px] p-4 rounded-xl border transition-all cursor-pointer ${
                          isIngressBroken
                            ? 'border-rose-500 bg-rose-950/20 animate-critical-pulse shadow-xl shadow-rose-900/30'
                            : selectedInspectorNode === 'ingress'
                            ? 'border-emerald-500/80 bg-slate-900/90 shadow-md shadow-emerald-950/20'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isIngressBroken
                              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          }`}>
                            <Server className="w-4 h-4" />
                          </div>
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                            isIngressBroken
                              ? 'text-rose-300 bg-rose-950 border border-rose-600 animate-pulse'
                              : 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50'
                          }`}>
                            {isIngressBroken ? 'DEMO FAULT' : 'DEMO HEALTHY'}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-slate-100">Ingestion API Gateway</div>
                        <div className="text-[11px] text-amber-300 font-mono mt-0.5">DEMO NODE · ingress-gw-4b82</div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>{isIngressBroken ? 'DEMO · 0 req/s' : 'DEMO · 1,420 req/s'}</span>
                          <span className={isIngressBroken ? 'text-rose-400 font-bold' : ''}>
                            {isIngressBroken ? 'DEMO · HTTP 401' : 'DEMO · 1.8ms'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Connecting Arrow 1 */}
                  <div className="flex items-center justify-center w-12 shrink-0">
                    <svg className="w-full h-8" viewBox="0 0 48 24">
                      <line
                        x1="4"
                        y1="12"
                        x2="40"
                        y2="12"
                        stroke={'ingress' in activeFaults || transformerFaultActive ? '#ef4444' : '#10b981'}
                        strokeWidth="2.5"
                        className={'ingress' in activeFaults ? '' : 'animate-flow-line'}
                      />
                      <polygon
                        points="36,7 46,12 36,17"
                        fill={'ingress' in activeFaults || transformerFaultActive ? '#ef4444' : '#10b981'}
                      />
                    </svg>
                  </div>

                  {/* Node 2: Data Transformer Node */}
                  {(() => {
                    const isTransformerBroken = transformerFaultActive;
                    const transformerMetrics = liveBackend?.transformer.metrics;
                    const transformerApiOnline = Boolean(liveBackend);
                    return (
                      <div
                        onClick={() => setSelectedInspectorNode('transformer')}
                        className={`flex-1 min-w-[220px] p-4 rounded-xl border transition-all cursor-pointer ${
                          isTransformerBroken
                            ? 'border-rose-500 bg-rose-950/20 animate-critical-pulse shadow-xl shadow-rose-900/30'
                            : selectedInspectorNode === 'transformer'
                            ? 'border-emerald-500/80 bg-slate-900/90 shadow-md shadow-emerald-950/20'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isTransformerBroken
                              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          }`}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                            !transformerApiOnline
                              ? 'text-amber-200 bg-amber-950/50 border border-amber-800/50'
                              : isTransformerBroken
                                ? 'text-rose-300 bg-rose-950 border border-rose-600 animate-pulse'
                                : 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50'
                          }`}>
                            {!liveBackend ? 'API OFFLINE' : isTransformerBroken ? 'LIVE FAULT' : 'LIVE HEALTHY'}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-slate-100">Data Transformer Node</div>
                        <div className="text-[11px] text-sky-300 font-mono mt-0.5">LIVE LOCAL API · transformer-worker-v2</div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>{transformerMetrics ? `${transformerMetrics.requests} requests` : 'Waiting for API'}</span>
                          <span className={isTransformerBroken ? 'text-rose-400 font-bold' : ''}>
                            {isTransformerBroken
                              ? (liveBackend?.transformer.logs.find((entry) => entry.level === 'error')?.code ?? 'Fault active')
                              : transformerMetrics?.lastLatencyMs !== null && transformerMetrics?.lastLatencyMs !== undefined
                                ? `${transformerMetrics.lastLatencyMs} ms last request`
                                : 'No request yet'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Connecting Arrow 2 */}
                  <div className="flex items-center justify-center w-12 shrink-0">
                    <svg className="w-full h-8" viewBox="0 0 48 24">
                      <line
                        x1="4"
                        y1="12"
                        x2="40"
                        y2="12"
                        stroke={transformerFaultActive || 'database' in activeFaults ? '#ef4444' : '#10b981'}
                        strokeWidth="2.5"
                        className={'transformer' in activeFaults ? '' : 'animate-flow-line'}
                      />
                      <polygon
                        points="36,7 46,12 36,17"
                        fill={transformerFaultActive || 'database' in activeFaults ? '#ef4444' : '#10b981'}
                      />
                    </svg>
                  </div>

                  {/* Node 3: Production Database */}
                  {(() => {
                    const isDbBroken = 'database' in activeFaults;
                    return (
                      <div
                        onClick={() => setSelectedInspectorNode('database')}
                        className={`flex-1 min-w-[200px] p-4 rounded-xl border transition-all cursor-pointer ${
                          isDbBroken
                            ? 'border-rose-500 bg-rose-950/20 animate-critical-pulse shadow-xl shadow-rose-900/30'
                            : selectedInspectorNode === 'database'
                            ? 'border-emerald-500/80 bg-slate-900/90 shadow-md shadow-emerald-950/20'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isDbBroken
                              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          }`}>
                            <Database className="w-4 h-4" />
                          </div>
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                            isDbBroken
                              ? 'text-rose-300 bg-rose-950 border border-rose-600 animate-pulse'
                              : 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/50'
                          }`}>
                            {isDbBroken ? 'DEMO FAULT' : 'DEMO HEALTHY'}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-slate-100">Production Database</div>
                        <div className="text-[11px] text-amber-300 font-mono mt-0.5">DEMO NODE · Aurora PG + Qdrant</div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>{isDbBroken ? 'DEMO · ABORTED' : 'DEMO · Pool: 64 conn'}</span>
                          <span className={isDbBroken ? 'text-rose-400 font-bold' : ''}>
                            {isDbBroken ? 'DEMO · Vector mismatch' : 'DEMO · 0.9ms'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Banner beneath visualizer */}
                <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  !isClusterHealthy
                    ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {!isClusterHealthy ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>
                      {!isClusterHealthy
                        ? `FAULT ACTIVE across ${failedNodesCount} node(s). Transformer state is live; any other impaired node is simulated.`
                        : 'Transformer local API is healthy. Ingestion and database show demo data.'}
                    </span>
                  </div>

                  {!isClusterHealthy && (
                    <span className="text-[11px] font-mono bg-rose-900/60 text-rose-200 px-2 py-0.5 rounded">
                      {failedNodesCount} Active Impairment(s)
                    </span>
                  )}
                </div>
              </div>

              <LiveTransformerPanel
                status={liveBackend}
                apiError={apiError}
                busy={backendBusy || diagnosisBusy || recoveryRunning}
                canaryRunning={liveCanaryRunning}
                onInject={() => void deployFaults(['transformer'])}
                onDiagnose={() => void analyzeLiveIncident()}
                onRunCanary={() => void handleRunCanaryTest('transformer')}
                onApprove={() => void handleApprovePatch('transformer')}
                onReject={() => void handleRejectPatch('transformer')}
                onReset={() => void handleResetDemo()}
              />

              {/* ==============================================================================
                  3. NODES ANOMALY DIAGNOSTIC CORE (RESPONSIVE TAB STRIP TOGGLE)
              ============================================================================== */}
              {!isClusterHealthy && selectedInspectorNode !== 'transformer' && (
                <div className="bg-[#0c121e] border border-slate-800 rounded-xl p-5 flex flex-col gap-4 animate-fadeIn">
                  
                  {/* Responsive Node Selector Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Nodes Anomaly Diagnostic Core
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {Object.keys(activeFaults).map(k => (
                        <button
                          key={k}
                          onClick={() => setSelectedInspectorNode(k)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedInspectorNode === k
                              ? 'bg-rose-900/60 border border-rose-500 text-rose-200 shadow-sm'
                              : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          {NODE_PROFILES[k].name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Raw Vector-Indexed Stack Trace for Inspected Node */}
                  {inspectedFault && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-rose-400" />
                          <span className="text-sm font-semibold text-rose-300">
                            Raw Stack Trace: {inspectedFault.profile.name}
                          </span>
                          <span className="text-xs text-slate-500">·</span>
                          <span className="text-xs font-mono text-slate-400">{inspectedFault.incident_id}</span>
                        </div>

                        <button
                          onClick={handleCopyCrashLog}
                          className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLog ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedLog ? 'Copied' : 'Copy Payload'}
                        </button>
                      </div>

                      <div className="bg-[#070b13] border border-rose-950 p-4 rounded-xl font-mono text-xs text-rose-300 leading-relaxed overflow-x-auto">
                        <div className="text-slate-400 mb-1">
                          # Node: {inspectedFault.profile.name} (Pod: {inspectedFault.profile.pod}) · Timestamp: {inspectedFault.timestamp}
                        </div>
                        <div className="text-amber-400 mb-2 font-bold">
                          # Exception: {inspectedFault.profile.error_type}
                        </div>
                        <pre className="text-rose-400 font-mono whitespace-pre-wrap">{inspectedFault.profile.traceback}</pre>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-slate-400">Failed Payload in {inspectedFault.profile.name}:</span>
                        <pre className="bg-[#070b13] border border-slate-800 p-3 rounded-lg text-xs font-mono text-amber-300 overflow-x-auto">
                          {JSON.stringify(inspectedFault.profile.failed_payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Vector Clustering & Root Cause Synthesis for Inspected Node */}
                  {inspectedFault && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                      
                      {/* Historically Similar Incidents */}
                      <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                              Historically Similar Incidents
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                            SAMPLE INCIDENT DATA
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 mt-1">
                          {inspectedFault.profile.similar_incidents.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono font-semibold text-slate-200">{item.incident_id}</span>
                                <span className="font-mono text-amber-200 font-bold bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded text-[11px]">
                                  DEMO
                                </span>
                              </div>
                              <div className="text-xs text-slate-300">{item.root_cause}</div>
                              <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                                <span>Occurred: {item.time_ago}</span>
                                <span className="text-amber-300">Sample</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Root Cause Synthesis Summary */}
                      <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                              Root Cause Synthesis Summary
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-200 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded font-mono">
                            DEMO PROFILE · NO LIVE MODEL
                          </span>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2.5 text-xs leading-relaxed">
                          <div>
                            <span className="text-slate-400 font-medium">Diagnosis: </span>
                            <span className="text-slate-200">{inspectedFault.profile.diagnosis}</span>
                          </div>

                          <div>
                            <span className="text-slate-400 font-medium">Failure Mode: </span>
                            <span className="text-slate-200">{inspectedFault.profile.failure_mode}</span>
                          </div>

                          <div>
                            <span className="text-slate-400 font-medium">Remediation Vector: </span>
                            <span className="text-emerald-300">{inspectedFault.profile.remediation}</span>
                          </div>
                        </div>

                        <div className="text-[10px] text-amber-300 mt-auto">Static example content for this demo node; confidence is not measured.</div>
                      </div>
                    </div>
                  )}

                  {/* Canary Shadow-Testing Terminal for Inspected Node */}
                  <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Simulated Canary · Demo Only ({inspectedFault?.profile.name})
                        </span>
                      </div>

                      <button
                        onClick={() => void handleRunCanaryTest()}
                        disabled={canaryRunning}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          canaryRunning
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                        }`}
                      >
                        {canaryRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                        {canaryRunning ? 'Running demo sequence…' : `🧪 Run demo canary (${inspectedFault?.profile.name})`}
                      </button>
                    </div>

                    <div className="bg-[#05080e] border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-2 font-mono text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] text-slate-500">
                        <span>sandbox-runner: simulated demo node</span>
                        <span className={canaryPassed ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          {canaryPassed ? 'DEMO SEQUENCE SHOWN' : canaryRunning ? 'RUNNING...' : 'IDLE'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 text-slate-300 min-h-[120px] max-h-[160px] overflow-y-auto">
                        {canaryLogs.length === 0 ? (
                          <div className="text-slate-500 italic py-5 text-center font-sans">
                            Demo canary idle. Click "Run demo canary" to play the sample sequence; no service is tested.
                          </div>
                        ) : (
                          canaryLogs.map((log, i) => (
                            <div
                              key={i}
                              className={
                                log.includes('[SUCCESS]')
                                  ? 'text-emerald-400 font-bold'
                                  : log.includes('[$]')
                                  ? 'text-slate-400'
                                  : 'text-slate-300'
                              }
                            >
                              {log}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Simulated Demo Sequence</span>
                          <span className="font-mono text-emerald-400">
                            {canaryPassed ? 'DEMO COMPLETE · no checks run' : canaryRunning ? 'DEMO RUNNING' : 'NOT RUN'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                            style={{ width: `${canaryProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Line-by-Line Code Diff for Inspected Node */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono px-1">
                      <span>Unified Diff: {inspectedFault?.profile.name} (Broken vs. Sanitized)</span>
                      <span className="text-emerald-400">+ Injected / - Stripped</span>
                    </div>

                    <div className="bg-[#070b13] border border-slate-800 rounded-xl p-3 font-mono text-xs overflow-x-auto leading-relaxed flex flex-col gap-0.5">
                      {computeDiffLines().map((line, idx) => (
                        <div
                          key={idx}
                          className={`px-3 py-1 rounded text-[11px] ${
                            line.type === 'added'
                              ? 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-500'
                              : line.type === 'removed'
                              ? 'bg-rose-500/15 text-rose-300 border-l-2 border-rose-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {line.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ==============================================================================
                      3. STRUCTURAL CARD-IMAGE STYLE LIST REPORT (SYSTEM BLUEPRINT CARD)
                  ============================================================================== */}
                  <div className="bg-gradient-to-b from-[#070e1b] to-[#040811] border-2 border-sky-400/80 rounded-xl p-5 shadow-[0_0_25px_rgba(56,189,248,0.2)] flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-sky-500/30 gap-2">
                      <div>
                        <span className="font-mono text-[11px] font-bold bg-sky-950/70 text-sky-400 border border-sky-600/60 px-2 py-0.5 rounded tracking-wide">
                          SYSTEM BLUEPRINT SPECIFICATION // ARCHITECTURAL AUDIT
                        </span>
                        <h4 className="mt-1.5 text-sm sm:text-base font-bold font-mono text-white flex items-center gap-2">
                          <span>📐 Structural System Blueprint &amp; Execution Report</span>
                        </h4>
                        <span className="text-[11px] font-mono text-sky-400">
                          STATUS: ACTIVE SRE FAULT MATRIX · HIGH-CONTRAST CONTAINER SPEC
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        IMPAIRED SERVICE VECTORS: {failedNodesCount}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {Object.keys(activeFaults).map(k => {
                        const prof = activeFaults[k].profile;
                        return (
                          <div
                            key={k}
                            className="bg-[#0b1324] border border-slate-800 border-l-4 border-l-rose-500 rounded-lg p-4 flex flex-col gap-2.5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 gap-1.5">
                              <div>
                                <span className="font-bold text-xs sm:text-sm font-mono text-white">
                                  🏢 {prof.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 ml-2">
                                  (Pod: {prof.pod})
                                </span>
                              </div>
                              <span className="text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-600 px-2.5 py-0.5 rounded shrink-0">
                                🌋 {prof.mutation_signature}
                              </span>
                            </div>

                            <div className="text-xs">
                              <span className="font-mono font-semibold text-sky-400">🆔 Incident Ticket ID: </span>
                              <code className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-sky-300 font-mono text-[11px]">
                                {prof.ticket_id}
                              </code>
                            </div>

                            <div className="text-xs flex flex-col gap-1">
                              <span className="font-mono font-semibold text-rose-400">💥 OS Core Impact Profile:</span>
                              <ul className="list-disc list-inside text-slate-300 text-[11px] leading-relaxed space-y-0.5 pl-1">
                                {prof.os_core_impact.map((bullet, idx) => (
                                  <li key={idx}>{bullet}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="text-xs flex flex-col gap-1 pt-1 border-t border-slate-800/60">
                              <span className="font-mono font-semibold text-emerald-400">🛡️ Programmatic Remediation Vector:</span>
                              <ol className="list-decimal list-inside text-sky-300 font-mono text-[11px] leading-relaxed space-y-0.5 pl-1">
                                {prof.remediation_vector.map((step, idx) => (
                                  <li key={idx} className="truncate">
                                    <code>{step}</code>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-Stage Recovery Execution Modal/Progress */}
                  {recoveryRunning ? (
                    <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 flex flex-col gap-3 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-400 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Running simulated recovery for demo nodes...
                        </span>
                        <span className="font-mono text-emerald-400 text-[11px]">
                          Stage {recoveryStage}/4
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                        {recoveryMessages.map((msg, idx) => (
                          <div key={idx} className="text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{msg}</span>
                          </div>
                        ))}
                      </div>

                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                          style={{ width: `${recoveryStage * 25}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Operator Signoff Action Buttons */
                    <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => void handleApprovePatch()}
                        disabled={!canaryPassed}
                        className={`flex-1 py-2 px-4 rounded-lg font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 ${
                          canaryPassed
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {canaryPassed
                          ? `Approve & Execute Patches Across ${failedNodesCount} Impaired Node(s)`
                          : 'Run Canary Test First Before Approval'}
                      </button>

                      <button
                        onClick={() => void handleRejectPatch()}
                        className="py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                        🛑 Reject Patch &amp; Force Manual Rollback
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ==============================================================================
                  🧠 DEEP-SYSTEM BACKEND ATTACK & REMEDIATION AUDIT LEDGER
              ============================================================================== */}
              <div className="bg-[#0c121e] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      🧠 Deep-System Backend Attack &amp; Remediation Audit Ledger
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {!isClusterHealthy ? `${failedNodesCount} Active Mutation Vector(s)` : 'Optimal Baseline (0 Mutations)'}
                  </span>
                </div>

                {!isClusterHealthy ? (
                  <div className="flex flex-col gap-4">
                    {/* Node tab selection if multiple active faults */}
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
                      {Object.keys(activeFaults).map(nodeKey => {
                        const prof = NODE_PROFILES[nodeKey];
                        const isSelected = selectedInspectorNode === nodeKey;
                        return (
                          <button
                            key={nodeKey}
                            onClick={() => setSelectedInspectorNode(nodeKey)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-rose-950/70 border border-rose-500 text-rose-200 shadow-md shadow-rose-950/40'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            <span>{prof.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Inspected node ledger details */}
                    {(() => {
                      const ledgerKey = selectedInspectorNode in activeFaults
                        ? selectedInspectorNode
                        : Object.keys(activeFaults)[0];
                      const ledgerProf = NODE_PROFILES[ledgerKey];

                      if (!ledgerProf) return null;

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left Column: Mutation Event & Backend Impact */}
                          <div className="flex flex-col gap-3 bg-[#070b13] border border-slate-800/80 rounded-xl p-4">
                            <div>
                              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                1. Raw System Mutation Event
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-600 px-2.5 py-1 rounded shadow-sm">
                                  ⚡ {ledgerProf.mutation_event}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Target Pod: {ledgerProf.pod}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-1">
                                Signal: {ledgerProf.error_type}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800/80">
                              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                2. Internal Backend Engine Impact
                              </div>
                              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-xs text-rose-200 leading-relaxed font-sans">
                                {ledgerProf.backend_impact}
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Automated Remediation Action Vector */}
                          <div className="flex flex-col gap-3 bg-[#070b13] border border-slate-800/80 rounded-xl p-4">
                            <div>
                              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                3. Automated Remediation Action Vector
                              </div>
                              <div className="text-[11px] text-slate-400 mb-2">
                                Step-by-step programmatic commands executed to fix infrastructure natively:
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                              {ledgerProf.remediation_vector.map((step, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded bg-[#05080e] border border-slate-800 border-l-2 border-l-emerald-500 text-sky-300 flex items-center justify-between gap-2"
                                >
                                  <span className="truncate">{step}</span>
                                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded shrink-0">
                                    [SANDBOX PASS]
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-auto pt-2 border-t border-slate-800/80 flex justify-between items-center text-[11px] text-slate-400">
                              <span>Zero Latency Drift Guarantee</span>
                              <span className="text-emerald-400 font-mono font-medium">Ready for Cluster Commit</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong className="text-emerald-200">Demo ledger baseline</strong> — No sample faults are active. Memory tables, buffers, and vector indexes are not connected or measured.
                      </span>
                    </div>
                    <span className="text-[11px] font-mono bg-emerald-900/40 text-emerald-300 px-2.5 py-1 rounded border border-emerald-700/40 shrink-0">
                      Zero Mutations
                    </span>
                  </div>
                )}
              </div>

              {/* ==============================================================================
                  5. HISTORICAL INCIDENT AUDIT TRAIL (DYNAMIC VARIED INTERVALS)
              ============================================================================== */}
              <div className="bg-[#0c121e] border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Transformer live audit · other rows are demo samples
                    </span>
                  </div>
                  <span className="text-xs text-sky-300 font-mono">LIVE + DEMO DATA</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-medium">
                        <th className="pb-2 font-mono">Incident ID</th>
                        <th className="pb-2">Node</th>
                        <th className="pb-2">Time Elapsed</th>
                        <th className="pb-2">Remediation Duration</th>
                        <th className="pb-2">Result</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {auditLog.map((heal, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2.5 text-emerald-400 font-semibold">{heal.id}</td>
                          <td className="py-2.5 text-slate-200 font-sans">{heal.node}</td>
                          <td className="py-2.5 text-sky-400 font-mono font-medium">
                            {formatTimeElapsed(heal.timestamp_epoch)}
                          </td>
                          <td className="py-2.5 text-slate-100 font-semibold">{heal.duration}</td>
                          <td className="py-2.5 text-slate-300 font-sans">{heal.result}</td>
                          <td className="py-2.5 text-right text-emerald-400 font-sans">
                            <span className="bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded text-[10px]">
                              {heal.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ==============================================================================
          LOWER FOOTER INFRASTRUCTURE STATE (ZERO RENDERING LAG)
      ============================================================================== */}
      <footer className="border-t border-slate-800/80 bg-[#0c121e] px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>AlgoHealer Autonomous SRE Platform · Build 2026.10</span>
          <span>·</span>
          <span>
            Cluster State:{' '}
            {!isClusterHealthy ? (
              <span className="text-rose-400 font-bold font-mono animate-pulse">💥 IMPAIRED</span>
            ) : (
              <span className="text-emerald-400 font-bold font-mono">✅ ACTIVE-OPTIMAL</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Transformer: local API · Ingestion/Database: demo data</span>
          <span>·</span>
          <span>Local isolated prototype</span>
        </div>
      </footer>
    </div>
  );
}
