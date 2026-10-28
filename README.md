# AlgoHealer local hackathon demo

AlgoHealer has two interfaces. The **React/Vite dashboard** is the main demo and connects to a small local API for a real, repeatable Data Transformer incident. The separate **Streamlit prototype** is preserved for its existing workflows; its incident, diagnosis, canary, and recovery content remains simulated and is labeled as demo data.

Only the transformer is connected to a live local service. Ingestion and database cards remain clearly marked demo data. The sign-in on both interfaces is a demo gate (`admin` / `algohealer2026`), not OAuth or production authentication. No production infrastructure is contacted.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.10+ only if you want to run the separate Streamlit prototype
- Optional: a Gemini API key for live model diagnosis. Without it, the dashboard uses an offline response labeled **Demo analysis**.

## Run the React dashboard

From the project folder, install dependencies and prepare the local environment file:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` if desired:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
API_PORT=3001
```

Leave `GEMINI_API_KEY` blank for offline **Demo analysis**. The backend reads the key from `.env.local`; it is never sent to the browser. Do not commit or include `.env.local` in a shared archive.

Start the API in one terminal:

```powershell
npm run backend
```

Start the React dashboard in a second terminal:

```powershell
npm run dev
```

Open the local Vite address, normally <http://localhost:3000>, and sign in with `admin` / `algohealer2026`. The local API listens on `127.0.0.1:3001`; Vite proxies dashboard API requests to it.

## Repeatable transformer demonstration

1. Sign in to the React dashboard and select **Data Transformer Node · LIVE LOCAL**.
2. Click **Reset demo** to restore the baseline.
3. Click **Inject transformer fault**. The API disables its legacy schema normalizer, sends a schema v1 sample through the actual transformer, records the returned error, and updates measured request/error/latency counters and the audit log.
4. Click **Analyze incident**. With a key configured, the server requests structured diagnosis from Gemini using the incident logs. Without a key, the UI labels the offline response **Demo analysis**. Both paths can recommend only the fixed repair action.
5. Click **Run canary**. The backend checks legacy schema conversion, current schema preservation, and safe rejection of an unsupported schema.
6. Click **Approve repair** to apply the fixed allow-listed normalizer repair. The backend verifies the transformed payload, records recovery time, and updates the audit log. If verification fails, it rolls back and leaves the fault active.
7. For the operator rejection path, reset, inject the fault, run canary, then click **Reject repair**. The incident remains faulted until you reset or approve a passing canary.
8. Click **Reset demo** to clear the incident, metrics, diagnosis, and audit history and repeat the walkthrough.

The model output is a diagnosis hypothesis only. Gemini must cite backend log IDs; the backend rejects unknown IDs and displays evidence directly from its own logs. The backend—not Gemini—selects a repair, and only when the real error code is `SCHEMA_NORMALIZER_DISABLED`. It cannot run model-generated code or shell commands. Applying the fixed `restore-legacy-schema-normalizer` repair always requires a passing canary and operator approval. This constrains repair risk; it does not prove every sentence in the diagnosis is true.

## Run the separate Streamlit prototype

The Streamlit app uses its original session-state workflows and does not connect to the React local API. Its metrics, diagnosis profiles, canary animation, audit history, and recovery sequence are demo simulations.

```powershell
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Open <http://localhost:8501>. Use the same demo credentials to unlock its prototype controls.

## Verification

```powershell
npm test
npm run lint
npm run build
```

The tests exercise deterministic fault injection, actual error logs and metrics, offline and mocked Gemini diagnosis, fabricated evidence rejection, backend repair eligibility, canary pass/fail, approval gating, rejection, recovery, rollback, and reset. The build produces the static React assets in `dist/`.

## Entry points

| File | Purpose |
| --- | --- |
| `index.html` → `src/main.tsx` → `src/App.tsx` | Main React/Vite dashboard |
| `server/index.mjs` | Loopback-only local API |
| `server/engine.mjs` | Deterministic transformer fault, checks, fixed repair, metrics, and audit state |
| `server/diagnosis.mjs` | Server-side structured Gemini diagnosis and offline fallback |
| `app.py` | Separate Streamlit demo prototype |
| `algohealer_app.py` | Compatibility copy of the Streamlit app |
| `public/app.py` | Streamlit source copy served to the React source viewer |
