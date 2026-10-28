import { createEngine } from '../server/engine.mjs';
import { createApiApp } from '../server/index.mjs';
import { decodeSignedState, encodeSignedState } from '../server/signed-state.mjs';

const runtime = globalThis;
runtime.__algohealerEngine ??= createEngine();
const engine = runtime.__algohealerEngine;
const app = createApiApp({ engine: runtime.__algohealerEngine, env: process.env });

export default function handler(request, response) {
  const secret = process.env.DEMO_STATE_SECRET;
  if (!secret) {
    return response.status(503).json({ error: 'Set DEMO_STATE_SECRET in Vercel project settings to preserve demo state between requests.' });
  }

  const cookieHeader = request.headers.cookie ?? '';
  const stateCookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('algohealer_state='));
  const savedState = stateCookie ? decodeSignedState(stateCookie.slice('algohealer_state='.length), secret) : null;
  engine.reset();
  if (savedState) engine.restoreState(savedState);

  const sendJson = response.json.bind(response);
  response.json = (body) => {
    const persisted = engine.exportState();
    persisted.state.logs = persisted.state.logs.slice(0, 12);
    persisted.state.audit = persisted.state.audit.slice(0, 20);
    const token = encodeSignedState(persisted, secret);
    response.setHeader('Set-Cookie', `algohealer_state=${token}; Path=/api; Max-Age=7200; HttpOnly; Secure; SameSite=Lax`);
    return sendJson(body);
  };

  return app(request, response);
}
