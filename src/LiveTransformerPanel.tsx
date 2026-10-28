import { Activity, AlertTriangle, CheckCircle2, Loader2, RotateCcw, ShieldCheck, Terminal } from 'lucide-react';
import type { LiveBackendStatus } from './liveTypes';

interface LiveTransformerPanelProps {
  status: LiveBackendStatus | null;
  apiError: string | null;
  busy: boolean;
  canaryRunning: boolean;
  onInject: () => void;
  onDiagnose: () => void;
  onRunCanary: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}

function Metric({ label, value, accent = 'text-slate-100' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-[#070b13] border border-slate-800 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-bold font-mono ${accent}`}>{value}</div>
    </div>
  );
}

export default function LiveTransformerPanel({
  status,
  apiError,
  busy,
  canaryRunning,
  onInject,
  onDiagnose,
  onRunCanary,
  onApprove,
  onReject,
  onReset,
}: LiveTransformerPanelProps) {
  const transformer = status?.transformer;
  const active = Boolean(transformer?.faultActive);
  const diagnosis = transformer?.diagnosis;
  const canary = transformer?.canary;
  const metrics = transformer?.metrics;

  return (
    <section className="bg-[#0c121e] border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Live Transformer Drill</h3>
            <span className="text-[10px] text-sky-300 bg-sky-950/50 border border-sky-800/60 px-2 py-0.5 rounded font-mono">LOCAL API</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">The transformer below is backed by the local API. Ingestion and database nodes remain demo data.</p>
        </div>
        <div className={`flex items-center gap-2 text-xs font-mono font-semibold ${active ? 'text-rose-300' : 'text-emerald-300'}`}>
          <span className={`w-2 h-2 rounded-full ${active ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
          {transformer ? (active ? 'FAULT ACTIVE' : 'HEALTHY') : 'API OFFLINE'}
        </div>
      </div>

      {apiError && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Metric label="Requests" value={String(metrics?.requests ?? '—')} />
        <Metric label="Errors" value={String(metrics?.errors ?? '—')} accent={active ? 'text-rose-300' : 'text-slate-100'} />
        <Metric label="Avg latency" value={metrics?.avgLatencyMs === null || metrics?.avgLatencyMs === undefined ? '—' : `${metrics.avgLatencyMs} ms`} />
        <Metric label="Recovered" value={String(metrics?.recoveredIncidents ?? '—')} accent="text-emerald-300" />
        <Metric label="Last MTTR" value={metrics?.lastRecoverySeconds === null || metrics?.lastRecoverySeconds === undefined ? '—' : `${metrics.lastRecoverySeconds}s`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-[#070b13] border border-slate-800 rounded-lg p-3 flex flex-col gap-2 min-h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Transformer service log</span>
            <span className="text-[10px] text-slate-600 font-mono">latest first</span>
          </div>
          {transformer?.logs.length ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {transformer.logs.slice(0, 6).map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className={`font-mono text-[10px] leading-relaxed ${entry.level === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                  <span className="text-slate-600">{new Date(entry.timestamp).toLocaleTimeString()} </span>
                  <span className="text-amber-300">{entry.code ?? entry.level.toUpperCase()}</span> {entry.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center text-xs text-slate-600">Inject the transformer fault to generate a real local error log.</div>
          )}
        </div>

        <div className="bg-[#070b13] border border-slate-800 rounded-lg p-3 flex flex-col gap-2 min-h-[150px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Diagnosis hypothesis</span>
            {diagnosis && (
              <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${diagnosis.source === 'gemini' ? 'text-sky-300 bg-sky-950/50 border-sky-800/60' : 'text-amber-200 bg-amber-950/40 border-amber-800/60'}`}>
                {diagnosis.source === 'gemini' ? `GEMINI · ${diagnosis.model}` : 'DEMO ANALYSIS'}
              </span>
            )}
          </div>
          {diagnosis ? (
            <>
              <p className="text-xs text-slate-200 leading-relaxed">{diagnosis.diagnosis}</p>
              <div className="text-[10px] text-slate-400">Confidence: <span className="text-slate-200 capitalize">{diagnosis.confidence}</span> · {diagnosis.confidenceExplanation}</div>
              <div className="text-[10px] text-slate-500">Verified log evidence: {diagnosis.evidence.map((entry) => `${entry.id} [${entry.code ?? entry.level}]: ${entry.message}`).join(' · ')}</div>
              {diagnosis.sourceMessage && <div className="text-[10px] text-amber-300">{diagnosis.sourceMessage}</div>}
              <div className="text-[10px] text-emerald-300">{diagnosis.recommendedAction ? `Backend-eligible action: ${diagnosis.recommendedAction}. ${diagnosis.actionReason}` : `No repair is eligible. ${diagnosis.actionReason}`} Model output never runs as code or a command.</div>
            </>
          ) : (
            <div className="flex-1 flex items-center text-xs text-slate-600">{active ? 'Diagnosis will use this incident’s server-side logs.' : 'No active incident to analyze.'}</div>
          )}
        </div>
      </div>

      {active && (
        <div className="bg-[#070b13] border border-slate-800 rounded-lg p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Canary checks · {canary?.mode ?? 'not run'}
            </div>
            {canary && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${canary.passed ? 'text-emerald-300 bg-emerald-950/50' : 'text-rose-300 bg-rose-950/50'}`}>
                {canary.passed ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}
              </span>
            )}
          </div>
          {canary?.tests.map((check) => (
            <div key={check.name} className="flex items-start gap-2 text-[11px]">
              {check.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
              <div><span className={check.passed ? 'text-slate-200' : 'text-rose-200'}>{check.name}</span><div className="text-slate-500 mt-0.5">{check.detail}</div></div>
            </div>
          ))}
          {!canary && <p className="text-xs text-slate-500">The canary runs deterministic checks against the fixed repair in memory; it does not execute model-generated code.</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <button onClick={onInject} disabled={!transformer || busy} className="px-3 py-2 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white">
            {busy ? <><Loader2 className="inline w-3.5 h-3.5 animate-spin mr-1" />Working…</> : 'Inject transformer fault'}
          </button>
        ) : (
          <>
            <button onClick={onDiagnose} disabled={busy} className="px-3 py-2 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-40">Analyze incident</button>
            <button onClick={onRunCanary} disabled={busy || canaryRunning} className="px-3 py-2 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40">
              {canaryRunning ? <><Loader2 className="inline w-3.5 h-3.5 animate-spin mr-1" />Running checks…</> : 'Run canary checks'}
            </button>
            <button onClick={onApprove} disabled={busy || !canary?.passed} className="px-3 py-2 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40">
              <ShieldCheck className="inline w-3.5 h-3.5 mr-1" />Approve and apply fixed repair
            </button>
            <button onClick={onReject} disabled={busy} className="px-3 py-2 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-200 disabled:opacity-40">Reject · keep fault active</button>
          </>
        )}
        <button onClick={onReset} disabled={!transformer || busy} className="px-3 py-2 rounded-md text-xs font-semibold bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40">
          <RotateCcw className="inline w-3.5 h-3.5 mr-1" />Reset demo
        </button>
      </div>
    </section>
  );
}
