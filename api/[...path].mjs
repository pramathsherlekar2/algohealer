import { createEngine } from '../server/engine.mjs';
import { createApiApp } from '../server/index.mjs';

// Reuse one engine across requests handled by the same warm Vercel function instance.
// Vercel may start another instance, so this demo state is not durable storage.
const runtime = globalThis;
runtime.__algohealerEngine ??= createEngine();

const app = createApiApp({ engine: runtime.__algohealerEngine, env: process.env });

export default function handler(request, response) {
  return app(request, response);
}
