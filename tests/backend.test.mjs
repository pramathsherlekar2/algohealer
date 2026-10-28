import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnoseIncident } from '../server/diagnosis.mjs';
import { createEngine, LEGACY_SAMPLE, REPAIR_ACTION_ID } from '../server/engine.mjs';
import { decodeSignedState, encodeSignedState } from '../server/signed-state.mjs';

test('fault injection creates a real transformer error log and updates measured metrics', () => {
  const engine = createEngine();
  const injected = engine.injectFault();

  assert.equal(injected.transformer.healthy, false);
  assert.equal(injected.transformer.incident.status, 'active');
  assert.equal(injected.transformer.metrics.requests, 1);
  assert.equal(injected.transformer.metrics.errors, 1);
  assert.match(injected.transformer.logs[0].message, /compatibility normalizer is disabled/);

  const failedRequest = engine.processPayload(LEGACY_SAMPLE);
  assert.equal(failedRequest.statusCode, 422);
  assert.equal(failedRequest.body.error, 'SCHEMA_NORMALIZER_DISABLED');
  assert.equal(engine.status().transformer.metrics.errors, 2);
});

test('diagnosis falls back to labeled offline analysis when no Gemini key is set', async () => {
  const engine = createEngine();
  engine.injectFault();
  const logs = engine.status().transformer.logs;
  const diagnosis = await diagnoseIncident(logs, { apiKey: '' });

  assert.equal(diagnosis.source, 'demo');
  assert.match(diagnosis.sourceMessage, /GEMINI_API_KEY is not configured/);
  assert.ok(diagnosis.evidence.some((entry) => entry.message.includes('compatibility normalizer is disabled')));
  assert.deepEqual(diagnosis.evidenceLogIds, diagnosis.evidence.map((entry) => entry.id));
  assert.equal(diagnosis.recommendedAction, REPAIR_ACTION_ID);
});

test('Gemini diagnosis uses server-side credentials and validates the structured response', async () => {
  const engine = createEngine();
  engine.injectFault();
  let receivedKey = null;
  const diagnosis = await diagnoseIncident(engine.status().transformer.logs, {
    apiKey: 'server-only-test-key',
    model: 'test-model',
    clientFactory: (key) => {
      receivedKey = key;
      return {
        models: {
          generateContent: async (request) => {
            assert.equal(request.model, 'test-model');
            assert.equal(request.config.responseMimeType, 'application/json');
            assert.match(request.contents, /SCHEMA_NORMALIZER_DISABLED/);
            return {
              text: JSON.stringify({
                diagnosis: 'The legacy schema normalizer is disabled.',
                evidenceLogIds: [engine.status().transformer.logs[0].id],
                confidence: 'high',
                confidenceExplanation: 'The log names the failing normalizer directly.',
              }),
            };
          },
        },
      };
    },
  });

  assert.equal(receivedKey, 'server-only-test-key');
  assert.equal(diagnosis.source, 'gemini');
  assert.equal(diagnosis.model, 'test-model');
  assert.equal(diagnosis.recommendedAction, REPAIR_ACTION_ID);
  assert.equal(diagnosis.evidence[0].id, diagnosis.evidenceLogIds[0]);
  assert.equal(diagnosis.evidence[0].message, engine.status().transformer.logs[0].message);
});

test('hallucinated evidence IDs are rejected and the offline fallback cites real logs', async () => {
  const engine = createEngine();
  engine.injectFault();
  const logs = engine.status().transformer.logs;
  const diagnosis = await diagnoseIncident(logs, {
    apiKey: 'server-only-test-key',
    clientFactory: () => ({ models: { generateContent: async () => ({ text: JSON.stringify({
      diagnosis: 'Unsupported fabricated cause.',
      evidenceLogIds: ['LOG-9999'],
      confidence: 'high',
      confidenceExplanation: 'Fabricated evidence.',
    }) }) } }),
  });

  assert.equal(diagnosis.source, 'demo');
  assert.equal(diagnosis.recommendedAction, REPAIR_ACTION_ID);
  assert.ok(diagnosis.evidenceLogIds.every((id) => logs.some((entry) => entry.id === id)));
  assert.match(diagnosis.sourceMessage, /invalid evidence/);
});

test('backend does not recommend a repair when the known trigger code is absent', async () => {
  const diagnosis = await diagnoseIncident([{
    id: 'LOG-9000', level: 'error', message: 'unrecognized failure', code: 'OTHER_ERROR', timestamp: '2026-01-01T00:00:00Z',
  }], { apiKey: '' });

  assert.equal(diagnosis.recommendedAction, null);
  assert.match(diagnosis.actionReason, /No backend-verified repair rule/);
});

test('signed Vercel state survives a fresh engine instance and rejects tampering', () => {
  const source = createEngine();
  source.injectFault();
  const secret = 'test-only-state-secret';
  const token = encodeSignedState(source.exportState(), secret);
  const restored = createEngine();
  restored.restoreState(decodeSignedState(token, secret));

  assert.equal(restored.status().transformer.faultActive, true);
  assert.equal(restored.status().transformer.metrics.errors, 1);
  assert.equal(restored.status().transformer.logs[0].id, 'LOG-0001');
  assert.equal(decodeSignedState(token, 'different-secret'), null);
  assert.equal(decodeSignedState(`${token}x`, secret), null);
});

test('canary passes the allow-listed repair and fails an unsupported action', () => {
  const engine = createEngine();
  engine.injectFault();

  const passing = engine.runCanary();
  assert.equal(passing.canary.passed, true);
  assert.equal(passing.canary.tests.length, 3);
  assert.ok(passing.canary.tests.every((check) => check.passed));

  const failing = engine.runCanary('arbitrary-shell-command');
  assert.equal(failing.canary.passed, false);
  assert.equal(failing.canary.tests[0].passed, false);
});

test('approval is blocked before a passing canary and recovery measures elapsed time', async () => {
  const engine = createEngine();
  engine.injectFault();

  const blocked = await engine.approveRepair();
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /passing canary/);

  engine.runCanary();
  const recovered = await engine.approveRepair();
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status.transformer.healthy, true);
  assert.equal(recovered.verification.ok, true);
  assert.equal(typeof recovered.recoverySeconds, 'number');
  assert.ok(recovered.status.transformer.audit.some((event) => event.event === 'repair_approved_and_verified'));
});

test('operator rejection preserves the active transformer fault', () => {
  const engine = createEngine();
  engine.injectFault();

  const rejected = engine.rejectRepair();
  assert.equal(rejected.ok, true);
  assert.equal(rejected.status.transformer.healthy, false);
  assert.equal(rejected.status.transformer.faultActive, true);
  assert.equal(rejected.status.transformer.normalizerEnabled, false);
  assert.equal(rejected.status.transformer.incident.status, 'rejected');
});

test('failed post-repair verification rolls back and leaves the service faulted', async () => {
  const engine = createEngine({ verifyAfterRepair: () => false });
  engine.injectFault();
  engine.runCanary();

  const response = await engine.approveRepair();
  assert.equal(response.ok, false);
  assert.equal(response.status.transformer.healthy, false);
  assert.equal(response.status.transformer.faultActive, true);
  assert.equal(response.status.transformer.normalizerEnabled, false);
  assert.ok(response.status.transformer.audit.some((event) => event.event === 'repair_rolled_back'));
});

test('reset restores a repeatable healthy baseline and clears live incident data', async () => {
  const engine = createEngine();
  engine.injectFault();
  const diagnosis = await diagnoseIncident(engine.status().transformer.logs, { apiKey: '' });
  engine.setDiagnosis(diagnosis);

  const reset = engine.reset();
  assert.equal(reset.transformer.healthy, true);
  assert.equal(reset.transformer.incident, null);
  assert.equal(reset.transformer.logs.length, 0);
  assert.equal(reset.transformer.audit.length, 0);
  assert.equal(reset.transformer.metrics.requests, 0);
});
