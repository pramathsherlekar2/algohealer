import { performance } from 'node:perf_hooks';

export const REPAIR_ACTION_ID = 'restore-legacy-schema-normalizer';
export const REPAIR_TRIGGER_CODE = 'SCHEMA_NORMALIZER_DISABLED';

export const LEGACY_SAMPLE = Object.freeze({
  schemaVersion: 1,
  batchId: 'demo-batch-001',
  records: [{ id: 'evt-001', value: 'cpu=0.42' }],
});

const CURRENT_SAMPLE = Object.freeze({
  schemaVersion: 2,
  batchId: 'demo-batch-002',
  records: [{ id: 'evt-002', value: 'memory=0.68' }],
});

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function transformPayload(payload, normalizerEnabled) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'Payload must be a JSON object.' };
  }

  if (payload.schemaVersion === 1) {
    if (!normalizerEnabled) {
      return {
        ok: false,
        code: REPAIR_TRIGGER_CODE,
        message: 'Legacy schema v1 rejected: the compatibility normalizer is disabled.',
      };
    }
    return {
      ok: true,
      output: { ...deepCopy(payload), schemaVersion: 2 },
      normalizedFrom: 1,
    };
  }

  if (payload.schemaVersion === 2) {
    return { ok: true, output: deepCopy(payload), normalizedFrom: null };
  }

  return {
    ok: false,
    code: 'UNSUPPORTED_SCHEMA',
    message: `Unsupported payload schema version: ${String(payload.schemaVersion)}.`,
  };
}

export function createEngine({ now = () => Date.now(), verifyAfterRepair = () => true } = {}) {
  let nextIncidentNumber = 1;
  let nextLogNumber = 1;
  let state;

  const freshState = () => ({
    normalizerEnabled: true,
    faultActive: false,
    incident: null,
    diagnosis: null,
    canary: null,
    logs: [],
    audit: [],
    metrics: {
      requests: 0,
      successes: 0,
      errors: 0,
      totalLatencyMs: 0,
      lastLatencyMs: null,
      injectedIncidents: 0,
      recoveredIncidents: 0,
      rejectedIncidents: 0,
      lastRecoverySeconds: null,
    },
  });

  const timestamp = () => new Date(now()).toISOString();

  function addAudit(event, result, incidentId = state.incident?.id ?? null, extra = {}) {
    state.audit.unshift({
      id: `AUD-${String(state.audit.length + 1).padStart(4, '0')}`,
      incidentId,
      node: 'Data Transformer Node',
      event,
      result,
      timestamp: timestamp(),
      timestampEpoch: now(),
      ...extra,
    });
  }

  function addLog(level, message, fields = {}) {
    const entry = {
      id: `LOG-${String(nextLogNumber++).padStart(4, '0')}`,
      timestamp: timestamp(),
      level,
      service: 'transformer-local',
      incidentId: state.incident?.id ?? null,
      message,
      ...fields,
    };
    state.logs.unshift(entry);
    state.logs = state.logs.slice(0, 100);
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(`[transformer-local] ${line}`);
    else console.info(`[transformer-local] ${line}`);
    return entry;
  }

  function execute(payload, { countMetrics = true, writeLog = true } = {}) {
    const started = performance.now();
    const result = transformPayload(payload, state.normalizerEnabled);
    const latencyMs = Math.max(0.01, Number((performance.now() - started).toFixed(2)));

    if (countMetrics) {
      state.metrics.requests += 1;
      state.metrics.totalLatencyMs += latencyMs;
      state.metrics.lastLatencyMs = latencyMs;
      if (result.ok) state.metrics.successes += 1;
      else state.metrics.errors += 1;
    }

    if (writeLog) {
      addLog(result.ok ? 'info' : 'error', result.ok ? 'Payload transformed successfully.' : result.message, {
        code: result.code ?? 'TRANSFORM_OK',
        schemaVersion: payload?.schemaVersion ?? null,
        latencyMs,
      });
    }

    return {
      statusCode: result.ok ? 200 : 422,
      body: result.ok
        ? { ok: true, output: result.output, normalizedFrom: result.normalizedFrom, latencyMs }
        : { ok: false, error: result.code, message: result.message, latencyMs },
    };
  }

  function snapshot() {
    const metrics = state.metrics;
    const avgLatencyMs = metrics.requests
      ? Number((metrics.totalLatencyMs / metrics.requests).toFixed(2))
      : null;
    return deepCopy({
      transformer: {
        healthy: !state.faultActive && state.normalizerEnabled,
        faultActive: state.faultActive,
        normalizerEnabled: state.normalizerEnabled,
        incident: state.incident,
        diagnosis: state.diagnosis,
        canary: state.canary,
        metrics: { ...metrics, avgLatencyMs },
        logs: state.logs.slice(0, 30),
        audit: state.audit.slice(0, 50),
      },
      demoServices: {
        ingestion: { label: 'DEMO DATA', healthy: true },
        database: { label: 'DEMO DATA', healthy: true },
      },
    });
  }

  function injectFault() {
    if (!state.faultActive) {
      const id = `INC-LOCAL-${String(nextIncidentNumber++).padStart(4, '0')}`;
      state.faultActive = true;
      state.normalizerEnabled = false;
      state.incident = {
        id,
        node: 'Data Transformer Node',
        status: 'active',
        startedAt: timestamp(),
        startedAtEpoch: now(),
        repairAction: REPAIR_ACTION_ID,
      };
      state.diagnosis = null;
      state.canary = null;
      state.metrics.injectedIncidents += 1;
      addAudit('fault_injected', 'Legacy payload normalization failed on the local transformer.');
    }

    const processResult = execute(LEGACY_SAMPLE);
    return { ...snapshot(), processResult };
  }

  function processPayload(payload) {
    return execute(payload);
  }

  function setDiagnosis(diagnosis) {
    state.diagnosis = deepCopy(diagnosis);
    addAudit('diagnosis_created', diagnosis.source === 'gemini' ? 'Gemini analyzed live transformer logs.' : 'Offline demo analysis generated from live transformer logs.', undefined, {
      source: diagnosis.source,
    });
    return snapshot();
  }

  function runCanary(actionId = REPAIR_ACTION_ID) {
    if (!state.faultActive) {
      return { ok: false, error: 'No active transformer incident to validate.', canary: null };
    }

    const candidateSupported = actionId === REPAIR_ACTION_ID;
    const legacy = transformPayload(LEGACY_SAMPLE, candidateSupported);
    const current = transformPayload(CURRENT_SAMPLE, candidateSupported);
    const unsupported = transformPayload({ schemaVersion: 999, records: [] }, candidateSupported);
    const tests = [
      {
        name: 'Legacy schema v1 is normalized to v2',
        passed: legacy.ok && legacy.output.schemaVersion === 2 && legacy.normalizedFrom === 1,
        detail: legacy.ok ? 'Candidate accepted the legacy sample and emitted schema v2.' : legacy.message,
      },
      {
        name: 'Current schema v2 remains unchanged',
        passed: current.ok && current.output.schemaVersion === 2 && current.normalizedFrom === null,
        detail: current.ok ? 'Current payload passed without an unnecessary rewrite.' : current.message,
      },
      {
        name: 'Unsupported schema is rejected safely',
        passed: !unsupported.ok && unsupported.code === 'UNSUPPORTED_SCHEMA',
        detail: unsupported.ok ? 'Unexpected schema was accepted.' : unsupported.message,
      },
    ];

    state.canary = {
      actionId,
      passed: tests.every((test) => test.passed),
      tests,
      completedAt: timestamp(),
      mode: 'local deterministic checks',
    };
    addAudit('canary_completed', state.canary.passed ? 'All local canary checks passed.' : 'Canary failed; repair remains blocked.', state.incident.id, {
      passed: state.canary.passed,
    });
    return { ok: true, canary: deepCopy(state.canary), status: snapshot() };
  }

  function rejectRepair() {
    if (!state.faultActive || !state.incident) {
      return { ok: false, error: 'There is no active transformer incident to reject.' };
    }
    state.metrics.rejectedIncidents += 1;
    state.incident.status = 'rejected';
    addAudit('repair_rejected', 'Operator rejected the candidate; transformer fault remains active.');
    return { ok: true, status: snapshot() };
  }

  async function approveRepair() {
    if (!state.faultActive || !state.incident) {
      return { ok: false, error: 'There is no active transformer incident to repair.' };
    }
    if (!state.canary?.passed || state.canary.actionId !== REPAIR_ACTION_ID) {
      return { ok: false, error: 'A passing canary for the allow-listed repair is required before approval.' };
    }

    const previousNormalizerState = state.normalizerEnabled;
    state.normalizerEnabled = true;
    const verification = execute(LEGACY_SAMPLE);
    let verified = verification.body.ok;
    try {
      verified = verified && Boolean(await verifyAfterRepair({ result: verification.body, status: snapshot() }));
    } catch {
      verified = false;
    }

    if (!verified) {
      state.normalizerEnabled = previousNormalizerState;
      state.faultActive = true;
      state.incident.status = 'active';
      state.incident.repairAction = REPAIR_ACTION_ID;
      state.canary = null;
      addLog('error', 'Post-repair verification failed; the previous normalizer state was restored.', { code: 'REPAIR_ROLLED_BACK' });
      addAudit('repair_rolled_back', 'Verification failed; the transformer remains faulted.');
      return { ok: false, error: 'Post-repair verification failed. Repair was rolled back and the fault remains active.', status: snapshot() };
    }

    const recoveredAt = now();
    const recoverySeconds = Math.max(0, Number(((recoveredAt - state.incident.startedAtEpoch) / 1000).toFixed(2)));
    state.faultActive = false;
    state.incident.status = 'recovered';
    state.incident.recoveredAt = new Date(recoveredAt).toISOString();
    state.incident.recoverySeconds = recoverySeconds;
    state.metrics.recoveredIncidents += 1;
    state.metrics.lastRecoverySeconds = recoverySeconds;
    addAudit('repair_approved_and_verified', `Allow-listed schema normalizer restored; local verification passed in ${recoverySeconds}s.`, state.incident.id, {
      durationSeconds: recoverySeconds,
      actionId: REPAIR_ACTION_ID,
    });
    return { ok: true, recoverySeconds, verification: verification.body, status: snapshot() };
  }

  function reset() {
    state = freshState();
    nextIncidentNumber = 1;
    nextLogNumber = 1;
    return snapshot();
  }

  state = freshState();
  return {
    status: snapshot,
    injectFault,
    processPayload,
    setDiagnosis,
    runCanary,
    rejectRepair,
    approveRepair,
    reset,
  };
}
