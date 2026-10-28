import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, REPAIR_ACTION_ID } from './engine.mjs';
import { diagnoseIncident } from './diagnosis.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: path.join(projectRoot, '.env.local') });

export function createApiApp({ engine = createEngine(), env = process.env, diagnose = diagnoseIncident } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/status', (_request, response) => response.json(engine.status()));

  app.post('/api/faults/transformer', (_request, response) => {
    response.json(engine.injectFault());
  });

  app.post('/api/transformer/process', (request, response) => {
    const result = engine.processPayload(request.body);
    response.status(result.statusCode).json(result.body);
  });

  app.post('/api/diagnose', async (_request, response) => {
    const status = engine.status();
    if (!status.transformer.faultActive || status.transformer.logs.length === 0) {
      return response.status(409).json({ error: 'Inject a transformer fault before requesting diagnosis.' });
    }
    const result = await diagnose(status.transformer.logs, {
      apiKey: env.GEMINI_API_KEY || '',
      model: env.GEMINI_MODEL || 'gemini-3.8-flash',
    });
    return response.json({ diagnosis: result, status: engine.setDiagnosis(result) });
  });

  app.post('/api/canary', (request, response) => {
    const result = engine.runCanary(request.body?.actionId || REPAIR_ACTION_ID);
    return response.status(result.ok ? 200 : 409).json(result);
  });

  app.post('/api/approve', async (_request, response) => {
    const result = await engine.approveRepair();
    return response.status(result.ok ? 200 : 409).json(result);
  });

  app.post('/api/reject', (_request, response) => {
    const result = engine.rejectRepair();
    return response.status(result.ok ? 200 : 409).json(result);
  });

  app.post('/api/reset', (_request, response) => response.json(engine.reset()));

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large') {
      return response.status(413).json({ error: 'Request payload is too large.' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    console.error('[algohealer-api] Unhandled local API error:', error?.message ?? 'unknown error');
    return response.status(500).json({ error: 'Local API request failed.' });
  });

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.API_PORT || 3001);
  const host = '127.0.0.1';
  const app = createApiApp();
  const server = app.listen(port, host, () => {
    console.log(`AlgoHealer local API listening at http://${host}:${port}`);
    console.log(`Gemini diagnosis: ${process.env.GEMINI_API_KEY ? 'configured' : 'offline demo analysis'}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
