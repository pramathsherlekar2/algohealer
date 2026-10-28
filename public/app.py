"""
AlgoHealer: Self-Healing AI Automation System
Single-File Streamlit Prototype for SRE & DevOps Incident Remediation
"""

# ==============================================================================
# LOCALHOST CONFIGURATION RUNTIME GATE (OFFLINE STANDALONE DEPLOYMENT)
# ==============================================================================
# Runtime Target: Localhost SRE Control Node
# Boot Command: streamlit run app.py
# Standard Library Stack: streamlit, pandas, plotly, difflib, json, time, random
# Offline Guarantee: Zero external cloud API requirements. Self-contained local sandbox.

import difflib
import json
import random
import time
from datetime import datetime
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# ==============================================================================
# 0. STREAMLIT PAGE CONFIGURATION & CUSTOM CSS
# ==============================================================================
st.set_page_config(
    page_title="AlgoHealer | Autonomous SRE Self-Healing Engine",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Professional SRE Dark/Modern CSS styling
st.markdown(
    """
    <style>
    /* Metric Card Styling with Responsive Headline Containment (Zero Truncation) */
    div[data-testid="stMetricValue"] {
        font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
        font-size: 1.15rem !important;
        font-weight: 700;
        white-space: normal !important;
        word-break: break-word !important;
        line-height: 1.3 !important;
    }
    div[data-testid="stMetricValue"] > div {
        font-size: 1.15rem !important;
        white-space: normal !important;
    }
    div[data-testid="stMetricDelta"] {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem !important;
    }
    
    /* Terminal Output Container */
    .terminal-box {
        background-color: #0b0f19;
        color: #10b981;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        padding: 14px 18px;
        border-radius: 8px;
        border: 1px solid #1e293b;
        font-size: 0.82rem;
        line-height: 1.6;
        white-space: pre-wrap;
    }
    
    /* Soft Colored Line-by-Line Diff Blocks */
    .diff-container {
        background-color: #070b13;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8rem;
        line-height: 1.5;
        overflow-x: auto;
    }
    .diff-line-added {
        background-color: rgba(16, 185, 129, 0.16);
        color: #34d399;
        display: block;
        padding: 2px 8px;
        border-left: 3px solid #10b981;
        margin: 1px 0;
        border-radius: 2px;
    }
    .diff-line-removed {
        background-color: rgba(239, 68, 68, 0.18);
        color: #f87171;
        display: block;
        padding: 2px 8px;
        border-left: 3px solid #ef4444;
        margin: 1px 0;
        border-radius: 2px;
    }
    .diff-line-context {
        color: #94a3b8;
        display: block;
        padding: 2px 8px;
        margin: 1px 0;
    }
    
    .status-badge-healthy {
        background-color: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid #059669;
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .status-badge-denied {
        background-color: rgba(239, 68, 68, 0.2);
        color: #ef4444;
        border: 1px solid #dc2626;
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.8rem;
    }
    .pulse-impaired {
        color: #ef4444;
        font-weight: 700;
        font-family: 'JetBrains Mono', monospace;
        animation: pulseText 1.5s infinite;
    }
    @keyframes pulseText {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
    }

    /* Microservice Dynamic Topology Cards */
    .topology-card-healthy {
        background-color: rgba(16, 185, 129, 0.08);
        border: 1px solid #10b981;
        border-radius: 10px;
        padding: 14px;
        transition: all 0.2s ease;
    }
    .topology-card-critical {
        background-color: rgba(239, 68, 68, 0.16);
        border: 2px solid #ef4444;
        border-radius: 10px;
        padding: 14px;
        animation: pulseCriticalCard 1.5s infinite;
    }
    @keyframes pulseCriticalCard {
        0%, 100% { border-color: #ef4444; box-shadow: 0 0 16px rgba(239, 68, 68, 0.45); }
        50% { border-color: #dc2626; box-shadow: 0 0 6px rgba(239, 68, 68, 0.15); }
    }

    /* Crisp Self-Contained System Blueprint Image Card */
    .blueprint-image-card {
        background: linear-gradient(180deg, #070e1b 0%, #040811 100%);
        border: 2px solid #38bdf8;
        box-shadow: 0 0 24px rgba(56, 189, 248, 0.25), inset 0 0 30px rgba(14, 165, 233, 0.04);
        border-radius: 12px;
        padding: 22px;
        margin: 18px 0;
        position: relative;
    }
    .blueprint-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid rgba(56, 189, 248, 0.35);
        padding-bottom: 12px;
        margin-bottom: 16px;
    }
    .blueprint-badge {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.72rem;
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid #0284c7;
        padding: 3px 8px;
        border-radius: 4px;
        letter-spacing: 0.05em;
        font-weight: 700;
    }
    .blueprint-report-item {
        background-color: #0b1324;
        border: 1px solid #1e293b;
        border-left: 4px solid #ef4444;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    }
    .mutation-sig-tag {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        font-size: 0.82rem;
        background-color: #450a0a;
        color: #f87171;
        border: 1px solid #dc2626;
        padding: 3px 10px;
        border-radius: 4px;
        display: inline-block;
    }
    .ledger-action-step {
        background-color: #05080e;
        border: 1px solid #1e293b;
        border-left: 3px solid #10b981;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8rem;
        color: #38bdf8;
        margin: 4px 0;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ==============================================================================
# HELPER: DYNAMIC TIME-ELAPSED ENGINE (ZERO STATIC STRINGS)
# ==============================================================================
def format_time_elapsed(epoch_timestamp: float) -> str:
    """Calculates dynamic human-readable relative time elapsed from system clock."""
    delta = max(0, int(time.time() - epoch_timestamp))
    if delta < 15:
        return "Just now"
    elif delta < 60:
        return f"{delta}s ago"
    elif delta < 3600:
        mins = delta // 60
        return f"{mins} minute{'s' if mins != 1 else ''} ago"
    elif delta < 86400:
        hours = delta // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    else:
        days = delta // 86400
        return f"{days} day{'s' if days != 1 else ''} ago"

# ==============================================================================
# 1. NODE SPECIFIC FAULT DEFINITIONS (INDEPENDENT EXCEPTION ROUTING & MUTATIONS)
# ==============================================================================
NODE_PROFILES = {
    "Ingestion API Gateway": {
        "name": "Ingestion API Gateway",
        "key": "ingress",
        "pod": "ingress-gw-4b82",
        "error_type": "requests.exceptions.HTTPError: 401 Unauthorized",
        "mutation_signature": "[STRIP_AUTH_HEADER]",
        "mutation_event": "STRIP_AUTH_HEADER",
        "ticket_id": "INC-2026-X8F2D-AUTH",
        "os_core_impact": [
            "Invalidation of active Redis JWT validation cache tables (TTL evicted on cluster node auth-worker-01).",
            "Upstream client dropped packet streams at proxy gateway boundary due to expired HMAC-SHA256 signature hash.",
            "Memory buffer starvation on ingress socket listeners (/v2/stream/ingest HTTP 401 Unauthorized cascade)."
        ],
        "backend_impact": "Invalidated JWT validation lifecycle cache tables in memory; dropped packet streams at gateway boundary layer (HTTP 401 unauthorized cascade across upstream proxies).",
        "remediation_vector": [
            "1. algohealer-cli auth --revoke-expired-claims --client-id=10.244.3.11",
            "2. vault kv get secret/cluster-master-jwt | openssl dgst -sha256 -hmac -key-sign",
            "3. kubectl exec -n ingress ingress-gw-4b82 -- /app/bin/hot-reload-tokens --apply",
            "4. curl -I -H 'Authorization: Bearer <VERIFIED_2026_SIG>' http://127.0.0.1:8080/healthz -> 200 OK"
        ],
        "traceback": (
            "Traceback (most recent call last):\n"
            '  File "/var/app/ingress/gateway.py", line 94, in verify_jwt_signature\n'
            "    response.raise_for_status()\n"
            '  File "/usr/lib/python3.10/requests/models.py", line 1021, in raise_for_status\n'
            '    raise HTTPError("401 Client Error: Bearer token signature HMAC expired or invalid header", response=self)\n'
            "requests.exceptions.HTTPError: 401 Unauthorized: Invalid HMAC-SHA256 signature"
        ),
        "failed_payload": {
            "endpoint": "/v2/stream/ingest",
            "auth_header": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired_signature",
            "client_ip": "10.244.3.11",
            "status": 401
        },
        "proposed_patch": {
            "endpoint": "/v2/stream/ingest",
            "auth_header": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.verified_active_sig_2026",
            "client_ip": "10.244.3.11",
            "token_renewed": True,
            "handshake_verified": "AlgoHealer_AuthGuard"
        },
        "diagnosis": "Ingress Gateway authentication crash due to an expired OAuth 2.0 Bearer JWT signature HMAC token in upstream request header.",
        "failure_mode": "Upstream client supplied signature from invalidated key rotation cycle, triggering requests.exceptions.HTTPError: 401 Unauthorized at line 94 of gateway.py.",
        "remediation": "Autonomous token re-signing with active cluster master key, refreshing cryptographic bearer claims.",
        "similar_incidents": [
            {"Incident ID": "INC-2026-8911", "Time Ago": "2 days ago", "Cosine Match": "95.1%", "Root Cause": "Expired HMAC Bearer signature rejected by Ingress proxy"},
            {"Incident ID": "INC-2026-8402", "Time Ago": "11 days ago", "Cosine Match": "87.4%", "Root Cause": "Clock skew invalidation in OAuth 2.0 handshake"}
        ]
    },
    "Data Transformer Node": {
        "name": "Data Transformer Node",
        "key": "transformer",
        "pod": "transformer-worker-v2",
        "error_type": "json.decoder.JSONDecodeError: Unterminated string starting at line 1 column 47",
        "mutation_signature": "[TRUNCATE_BYTE_STREAM]",
        "mutation_event": "TRUNCATE_BYTE_STREAM",
        "ticket_id": "INC-2026-T409B-JSON",
        "os_core_impact": [
            "Deserialization parser stack overflow on unquoted byte stream buffer offset 47.",
            "Worker thread stalled in JVM/heap memory contention waiting on terminating double-quote delimiter.",
            "Truncated chunk dropped from live stream ingestion pipeline, blocking downstream ETL transformer workers."
        ],
        "backend_impact": "Parser stack overflow on unquoted byte stream offset 47; worker deserialization worker thread stalled in heap with memory contention (JSONDecodeError unhandled abort).",
        "remediation_vector": [
            "1. algohealer-cli pipeline pause-ingress --node=transformer-worker-v2",
            "2. py-ast-transpile --strict-rfc8259 --quote-unquoted-literals /var/app/transformer/worker.py",
            "3. injection-sandbox --mount-patch /tmp/patch_sanitized.json --test-ast",
            "4. kubectl rollout restart deployment/transformer-worker --namespace=production"
        ],
        "traceback": (
            "Traceback (most recent call last):\n"
            '  File "/var/app/transformer/worker.py", line 184, in process_stream\n'
            "    validated_record = json.loads(raw_json_chunk)\n"
            '  File "/usr/lib/python3.10/json/__init__.py", line 346, in loads\n'
            "    return _default_decoder.decode(s)\n"
            '  File "/usr/lib/python3.10/json/decoder.py", line 337, in decode\n'
            "    obj, end = self.raw_decode(s, idx=_w(s, 0).end())\n"
            '  File "/usr/lib/python3.10/json/decoder.py", line 355, in raw_decode\n'
            '    raise JSONDecodeError("Unterminated string starting at", s, err.value) from None\n'
            "json.decoder.JSONDecodeError: Unterminated string starting at line 1 column 47"
        ),
        "failed_payload": {
            "tenant_uuid": "00000000-0000-0000-0000-000000000000",
            "customer_id": "CUST-40912",
            "transaction_val": 1850.50,
            "currency": "USD",
            "metadata_raw": "{invalid_unquoted_token: true"
        },
        "proposed_patch": {
            "tenant_uuid": "00000000-0000-0000-0000-000000000000",
            "customer_id": "CUST-40912",
            "transaction_val": 1850.50,
            "currency": "USD",
            "timestamp": "2026-10-27T23:00:00Z",
            "metadata_raw": "{\"token_state\": \"sanitized\", \"normalized_by\": \"AlgoHealer_ZeroShot_Agent\", \"recovered\": true}"
        },
        "diagnosis": "Fatal JSON syntax parser crash caused by an unescaped, unquoted token inside metadata_raw truncating the byte stream at line 1 column 47.",
        "failure_mode": "Upstream serialization emitted unquoted literal token '{invalid_unquoted_token: true' without terminating quotes, causing Python's json.decoder to abort with Unterminated string starting at line 1 column 47 at line 184 of worker.py.",
        "remediation": "Sanitize and quote malformed metadata tokens into compliant RFC 8259 JSON structure, inject verified timestamp envelope, and resume transformer stream.",
        "similar_incidents": [
            {"Incident ID": "INC-2026-9042", "Time Ago": "3 days ago", "Cosine Match": "94.2%", "Root Cause": "Unescaped unquoted token truncated serialization stream at byte offset 47"},
            {"Incident ID": "INC-2026-8819", "Time Ago": "9 days ago", "Cosine Match": "88.7%", "Root Cause": "Unquoted JSON string payload from legacy gateway truncated buffer"}
        ]
    },
    "Production Database": {
        "name": "Production Database",
        "key": "database",
        "pod": "aurora-pg-qdrant-cluster",
        "error_type": "qdrant_client.errors.UnexpectedResponse: Vector dimension mismatch (expected 1536, got 768)",
        "mutation_signature": "[VECTOR_DIM_MISMATCH]",
        "mutation_event": "VECTOR_DIM_MISMATCH",
        "ticket_id": "INC-2026-Q412E-DB",
        "os_core_impact": [
            "Vector HNSW index memory page corruption caused by 768d vs 1536d projection collision.",
            "Qdrant storage ring-buffer stalled with UnexpectedResponse: 400 Bad Request dimension fault.",
            "Transactional commit deadlock on /data/qdrant/storage/wal, forcing WAL replay rollback."
        ],
        "backend_impact": "Vector HNSW index memory page corrupted by 768d vs 1536d projection collision; throttled transactional commit ring-buffer and stalled ingestion queues.",
        "remediation_vector": [
            "1. qdrant-admin collections --name=telemetry_traces inspect --lock-writes",
            "2. vector-adapter --project 768 -> 1536 --model=text-embedding-3-large --reconcile",
            "3. hnsw-index-rebuild --threads=8 --verify-integrity /data/qdrant/storage/wal",
            "4. qdrant-admin collections --name=telemetry_traces unlock-writes --resume-stream"
        ],
        "traceback": (
            "Traceback (most recent call last):\n"
            '  File "/var/app/db/vector_client.py", line 92, in upsert_points\n'
            '    client.upsert(collection_name="telemetry_traces", points=batch)\n'
            '  File "/usr/local/lib/python3.10/dist-packages/qdrant_client/qdrant_client.py", line 412, in upsert\n'
            '    raise UnexpectedResponse(400, "Vector dimension mismatch: index expects dense 1536d, received 768d")\n'
            "qdrant_client.errors.UnexpectedResponse: Vector dimension mismatch in collection 'telemetry_traces': expected 1536, got 768"
        ),
        "failed_payload": {
            "collection": "telemetry_traces",
            "vector_dim": 768,
            "expected_dim": 1536,
            "embedding_model": "text-embedding-ada-002-legacy",
            "payload_id": "vec_point_9921"
        },
        "proposed_patch": {
            "collection": "telemetry_traces",
            "vector_dim": 1536,
            "expected_dim": 1536,
            "embedding_model": "text-embedding-3-large",
            "payload_id": "vec_point_9921",
            "projected_by": "AlgoHealer_VectorAdapter"
        },
        "diagnosis": "Dense vector dimension mismatch during database upsert into Qdrant vector collection 'telemetry_traces'.",
        "failure_mode": "Upstream embedding model produced deprecated 768-dimensional vectors while target HNSW index strictly requires 1536-dimensional embeddings, throwing qdrant_client.errors.UnexpectedResponse at line 92 of vector_client.py.",
        "remediation": "Re-project input vector array using zero-shot dimension adapter to 1536-dim standard, synchronize schema, and flush uncommitted batch.",
        "similar_incidents": [
            {"Incident ID": "INC-2026-8740", "Time Ago": "5 days ago", "Cosine Match": "96.4%", "Root Cause": "Legacy 768d vector array passed to 1536d Qdrant collection"},
            {"Incident ID": "INC-2026-8119", "Time Ago": "14 days ago", "Cosine Match": "89.2%", "Root Cause": "Schema drift in HNSW vector index parameter"}
        ]
    }
}

# Aliases for compatibility
NODE_PROFILES["ingress"] = NODE_PROFILES["Ingestion API Gateway"]
NODE_PROFILES["transformer"] = NODE_PROFILES["Data Transformer Node"]
NODE_PROFILES["database"] = NODE_PROFILES["Production Database"]

# ==============================================================================
# 2. STATE INITIALIZATION (st.session_state)
# ==============================================================================
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "auth_user" not in st.session_state:
    st.session_state.auth_user = None
if "auth_error" not in st.session_state:
    st.session_state.auth_error = None

# SRE Stage Tracker: NOMINAL | FAULT_ACTIVE
if "current_stage" not in st.session_state:
    st.session_state.current_stage = "NOMINAL"
if "rejection_occurred" not in st.session_state:
    st.session_state.rejection_occurred = False
if "rejection_message" not in st.session_state:
    st.session_state.rejection_message = None

# Multi-Node Fault States: Standard Python list object storing string node names
if "active_faults" not in st.session_state:
    st.session_state.active_faults = []
if "selected_inspector_node" not in st.session_state:
    st.session_state.selected_inspector_node = "Data Transformer Node"

# DYNAMIC HISTORICAL DATA ENGINE INITIALIZATION (REALISTIC BASELINE WITH TRUE TIMESTAMPS)
if "resolved_incidents_log" not in st.session_state:
    current_boot_time = time.time()
    st.session_state.resolved_incidents_log = [
        {
            "Incident Ticket ID": "INC-2026-9042-TRNS",
            "Node": "Data Transformer Node",
            "timestamp_epoch": current_boot_time - 14 * 60,  # 14 minutes ago
            "Remediation Duration": "11.85s",
            "Result": "Sample demo action",
            "Status": "DEMO DATA · not verified"
        },
        {
            "Incident Ticket ID": "INC-2026-8911-INGR",
            "Node": "Ingestion API Gateway",
            "timestamp_epoch": current_boot_time - 74 * 60,  # 1 hour 14 minutes ago
            "Remediation Duration": "12.41s",
            "Result": "Token Auto-Renewed",
            "Status": "DEMO DATA · not verified"
        },
        {
            "Incident Ticket ID": "INC-2026-8740-DB01",
            "Node": "Production Database",
            "timestamp_epoch": current_boot_time - 190 * 60,  # 3 hours ago
            "Remediation Duration": "11.24s",
            "Result": "Vector Dimension Re-Projected",
            "Status": "DEMO DATA · not verified"
        },
        {
            "Incident Ticket ID": "INC-2026-8622-TRNS",
            "Node": "Data Transformer Node",
            "timestamp_epoch": current_boot_time - 420 * 60,  # 7 hours ago
            "Remediation Duration": "12.05s",
            "Result": "RFC 8259 Sanitizer Mounted",
            "Status": "DEMO DATA · not verified"
        },
        {
            "Incident Ticket ID": "INC-2026-8402-INGR",
            "Node": "Ingestion API Gateway",
            "timestamp_epoch": current_boot_time - 1440 * 60,  # 1 day ago
            "Remediation Duration": "11.92s",
            "Result": "HMAC Secret Key Re-Signed",
            "Status": "DEMO DATA · not verified"
        }
    ]

# Backward compatibility mirror
st.session_state.incident_history = st.session_state.resolved_incidents_log

if "mttr_display" not in st.session_state:
    st.session_state.mttr_display = "12 seconds"
if "snapshot_taken" not in st.session_state:
    st.session_state.snapshot_taken = False
if "snapshot_hash" not in st.session_state:
    st.session_state.snapshot_hash = None
if "canary_passed" not in st.session_state:
    st.session_state.canary_passed = False
if "canary_logs" not in st.session_state:
    st.session_state.canary_logs = []

# ==============================================================================
# 3. SIDEBAR AUTHENTICATION GATEWAY
# ==============================================================================
with st.sidebar:
    st.title("🛡️ AlgoHealer")
    st.caption("Streamlit prototype · workflows and infrastructure metrics are demo simulations")
    st.divider()

    st.subheader("Demo Sign-In")

    if not st.session_state.authenticated:
        st.markdown(
            "This local demo gate only unlocks the prototype controls. It is not production authentication."
        )

        with st.form("auth_form"):
            username = st.text_input("Username / Operator ID", placeholder="e.g. admin")
            password = st.text_input("Password / Secret Key", type="password", placeholder="e.g. algohealer2026")
            submit_auth = st.form_submit_button("Verify & Sign In", use_container_width=True)

            if submit_auth:
                # Real string checking logic: admin / algohealer2026
                if username == "admin" and password == "algohealer2026":
                    st.session_state.authenticated = True
                    st.session_state.auth_user = username
                    st.session_state.auth_error = None
                    st.rerun()
                else:
                    st.session_state.auth_error = "Access Denied: Invalid credentials provided."

        if st.session_state.auth_error:
            st.markdown(
                f'<div class="status-badge-denied">🚫 {st.session_state.auth_error}</div>',
                unsafe_allow_html=True,
            )
            st.caption("Demo credentials: `admin` / `algohealer2026`")
    else:
        st.markdown(
            '<div class="status-badge-healthy">🔒 Demo session · no OAuth configured</div>',
            unsafe_allow_html=True,
        )
        st.write(f"**Demo operator**: `{st.session_state.auth_user}`")

        if st.button("Sign Out / Lock Console", use_container_width=True):
            st.session_state.authenticated = False
            st.session_state.auth_user = None
            st.session_state.auth_error = None
            st.rerun()

    st.divider()

    # ==============================================================================
    # 4. MULTI-TERMINAL CHAOS CORE (INDEPENDENT & SIMULTANEOUS CHECKBOX INJECTION)
    # ==============================================================================
    st.subheader("Demo Fault Controls")

    if not st.session_state.authenticated:
        st.warning("🔒 Chaos Engine Locked. Authenticate above to unlock injection triggers.")
    else:
        st.caption("Streamlit fault state is local session data; this app does not call the live React demo backend.")
        target_ingress = st.checkbox("Ingestion API Gateway · DEMO", value=False)
        target_transformer = st.checkbox("Data Transformer Node · DEMO", value=False)
        target_database = st.checkbox("Production Database · DEMO", value=False)

        deploy_fault_btn = st.button("⚡ Simulate Demo Fault Injection", type="primary", use_container_width=True)

        if deploy_fault_btn:
            selected_nodes = []
            if target_ingress:
                selected_nodes.append("Ingestion API Gateway")
            if target_transformer:
                selected_nodes.append("Data Transformer Node")
            if target_database:
                selected_nodes.append("Production Database")

            if not selected_nodes:
                st.warning("Please check at least one target node before deploying fault.")
            else:
                for n in selected_nodes:
                    if n not in st.session_state.active_faults:
                        st.session_state.active_faults.append(n)
                
                # Explicitly set current_stage to FAULT_ACTIVE
                st.session_state.current_stage = "FAULT_ACTIVE"
                st.session_state.rejection_occurred = False
                st.session_state.rejection_message = None
                st.session_state.snapshot_taken = False
                st.session_state.canary_passed = False
                st.session_state.canary_logs = []
                st.session_state.selected_inspector_node = selected_nodes[0]
                st.rerun()

    # Lower-Left Infrastructure State (Zero rendering lag)
    st.divider()
    is_cluster_healthy = (len(st.session_state.active_faults) == 0) and (st.session_state.current_stage != "FAULT_ACTIVE")
    st.markdown("**Infrastructure Cluster State**")
    if not is_cluster_healthy:
        st.markdown(
            '<span class="pulse-impaired">💥 IMPAIRED</span> '
            f'<small>({len(st.session_state.active_faults)} active faults)</small>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<span style="color:#10b981; font-weight:700; font-family: monospace;">✅ ACTIVE-OPTIMAL</span> '
            '<small>(All nodes clean)</small>',
            unsafe_allow_html=True,
        )
    st.caption("Vector Store: demo profile · Canary Sandbox: simulated")


# ==============================================================================
# 5. DASHBOARD MAIN VIEWPORT & SECURITY LOCK SCREEN
# ==============================================================================
if not st.session_state.authenticated:
    st.markdown(
        """
        <div style="text-align: center; padding: 60px 20px; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 14px; margin-top: 40px;">
            <div style="font-size: 3rem; margin-bottom: 12px;">🔒</div>
            <h2 style="color: #f87171; margin-bottom: 8px;">AlgoHealer Demo: Sign-In Required</h2>
            <p style="color: #94a3b8; max-width: 500px; margin: 0 auto 20px auto; font-size: 0.95rem;">
                The simulated Streamlit workflows are locked until you use the demo sign-in in the sidebar.
            </p>
            <div style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); border: 1px solid #dc2626; color: #ef4444; padding: 6px 16px; border-radius: 8px; font-weight: 600; font-family: monospace;">
                Demo credentials: admin / algohealer2026
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.stop()


# ==============================================================================
# 6. TOP KPI ANALYTICS BAR (DYNAMIC HEALTH, STATUS, MTTR & DYNAMIC COUNTER TRACKING)
# ==============================================================================
st.title("🛡️ AlgoHealer Control Center")
st.markdown("Streamlit prototype · fault injection, diagnosis, canary and recovery outputs are simulated demo data")

# Rejection Alert Banner if Operator Rejected Candidate Patch
if st.session_state.rejection_occurred and st.session_state.rejection_message:
    st.error(st.session_state.rejection_message)

# Global Active Fault Evaluation
active_faults_count = len(st.session_state.active_faults)
total_nodes = 3
healthy_nodes_count = max(0, total_nodes - active_faults_count)
is_cluster_healthy = (active_faults_count == 0) and (st.session_state.current_stage != "FAULT_ACTIVE")

# Synchronized Pipeline Health Metric
calculated_health_percent = round((healthy_nodes_count / total_nodes) * 100, 1) if not is_cluster_healthy else 100.0

# DYNAMIC INCIDENT COUNTER TRACKING LINKED DIRECTLY TO len(st.session_state.resolved_incidents_log)
total_incidents_healed = len(st.session_state.resolved_incidents_log)
total_incidents_fired = total_incidents_healed + active_faults_count

if total_incidents_fired > 0:
    calculated_success_rate = round(
        (total_incidents_healed / total_incidents_fired) * 100, 1
    )
else:
    calculated_success_rate = 100.0

col1, col2, col3, col4 = st.columns([1, 1.25, 1, 1])

with col1:
    st.metric(
        label="Demo Pipeline Health",
        value=f"{calculated_health_percent}%",
        delta=f"-{round((active_faults_count/total_nodes)*100, 1)}% Impairment" if not is_cluster_healthy else "+Healthy",
        delta_color="inverse" if not is_cluster_healthy else "normal"
    )

with col2:
    st.metric(
        label="Demo Pipeline Status",
        value="CRITICAL IMPAIRMENT DETECTED" if not is_cluster_healthy else "NOMINAL (100%)",
        delta=f"{active_faults_count} Nodes Impaired" if not is_cluster_healthy else "All Nodes Synced",
        delta_color="inverse" if not is_cluster_healthy else "normal"
    )

with col3:
    st.metric(
        label="Demo MTTR",
        value="Calculating..." if not is_cluster_healthy else st.session_state.mttr_display,
        delta="Demo incident state" if not is_cluster_healthy else "Sample baseline · not measured",
        delta_color="off" if not is_cluster_healthy else "normal"
    )

with col4:
    st.metric(
        label="Demo Healing Rate",
        value=f"{calculated_success_rate}%",
        delta=f"{total_incidents_healed}/{total_incidents_fired} Resolved"
    )

st.divider()

# ==============================================================================
# 7. DYNAMIC DEPENDENCY GRAPH & MULTI-CARD TOPOLOGY (INDEPENDENT CARD STYLES)
# ==============================================================================
st.subheader("1. Dynamic Microservice Architecture & Health Map")

def render_dependency_graph(active_faults_list):
    """Generates an interactive Plotly pipeline graph showing live health states for all nodes."""
    x_pos = [1, 2.5, 4]
    y_pos = [1, 1, 1]

    # Evaluate using inline containment check against st.session_state.active_faults
    ingress_broken = ("Ingestion API Gateway" in active_faults_list) or ("ingress" in active_faults_list)
    transformer_broken = ("Data Transformer Node" in active_faults_list) or ("transformer" in active_faults_list)
    db_broken = ("Production Database" in active_faults_list) or ("database" in active_faults_list)

    node_colors = [
        "#ef4444" if ingress_broken else "#10b981",
        "#ef4444" if transformer_broken else "#10b981",
        "#ef4444" if db_broken else "#10b981"
    ]
    node_labels = [
        "Ingestion API<br><b>[CRITICAL FAULT]</b>" if ingress_broken else "Ingestion API<br><b>[HEALTHY]</b>",
        "Data Transformer<br><b>[CRITICAL FAULT]</b>" if transformer_broken else "Data Transformer<br><b>[HEALTHY]</b>",
        "Production DB<br><b>[CRITICAL FAULT]</b>" if db_broken else "Production DB<br><b>[HEALTHY]</b>"
    ]

    fig = go.Figure()

    # Draw pipeline edges
    fig.add_annotation(
        x=2.5, y=1, ax=1, ay=1,
        xref="x", yref="y", axref="x", ayref="y",
        showarrow=True, arrowhead=2, arrowsize=1.5, arrowwidth=2.5,
        arrowcolor="#ef4444" if (ingress_broken or transformer_broken) else "#38bdf8"
    )
    fig.add_annotation(
        x=4, y=1, ax=2.5, ay=1,
        xref="x", yref="y", axref="x", ayref="y",
        showarrow=True, arrowhead=2, arrowsize=1.5, arrowwidth=2.5,
        arrowcolor="#ef4444" if (transformer_broken or db_broken) else "#38bdf8"
    )

    # Draw Nodes
    fig.add_trace(go.Scatter(
        x=x_pos,
        y=y_pos,
        mode="markers+text",
        marker=dict(
            size=60,
            color=node_colors,
            line=dict(color="#ffffff", width=2),
            symbol="circle"
        ),
        text=node_labels,
        textposition="top center",
        hoverinfo="text"
    ))

    fig.update_layout(
        height=220,
        margin=dict(l=20, r=20, t=35, b=20),
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[0.3, 4.7]),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[0.4, 1.8]),
        plot_bgcolor="#090d16",
        paper_bgcolor="#090d16",
        font=dict(color="#e2e8f0", family="monospace")
    )
    return fig

st.plotly_chart(render_dependency_graph(st.session_state.active_faults), use_container_width=True)

# 3 INDEPENDENT TOPOLOGY CARDS (DYNAMIC EVALUATION VIA INLINE CONTAINMENT CHECK)
col_top1, col_top2, col_top3 = st.columns(3)

with col_top1:
    node_name = "Ingestion API Gateway"
    if node_name in st.session_state.active_faults or "ingress" in st.session_state.active_faults:
        card_cls = "topology-card-critical"
        badge_cls = "status-badge-denied"
        badge_txt = "🔴 CRITICAL FAULT"
        sub_txt = "HTTP 401 Unauthorized (0 req/s DROPPED)"
        sub_color = "#f87171"
    else:
        card_cls = "topology-card-healthy"
        badge_cls = "status-badge-healthy"
        badge_txt = "🟢 HEALTHY"
        sub_txt = "Normal (1,420 req/s · 1.8ms lat)"
        sub_color = "#34d399"

    st.markdown(
        f"""
        <div class="{card_cls}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <b style="font-size: 0.95rem; color: #f1f5f9;">{node_name}</b>
                <span class="{badge_cls}">{badge_txt}</span>
            </div>
            <div style="font-family: monospace; font-size: 0.75rem; color: #94a3b8;">Pod: ingress-gw-4b82</div>
            <div style="margin-top: 8px; font-family: monospace; font-size: 0.8rem; color: {sub_color}; font-weight: 600;">
                {sub_txt}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

with col_top2:
    node_name = "Data Transformer Node"
    if node_name in st.session_state.active_faults or "transformer" in st.session_state.active_faults:
        card_cls = "topology-card-critical"
        badge_cls = "status-badge-denied"
        badge_txt = "🔴 CRITICAL FAULT"
        sub_txt = "JSONDecodeError (0 req/s DROPPED)"
        sub_color = "#f87171"
    else:
        card_cls = "topology-card-healthy"
        badge_cls = "status-badge-healthy"
        badge_txt = "🟢 HEALTHY"
        sub_txt = "Normal (1,380 req/s · 4.2ms lat)"
        sub_color = "#34d399"

    st.markdown(
        f"""
        <div class="{card_cls}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <b style="font-size: 0.95rem; color: #f1f5f9;">{node_name}</b>
                <span class="{badge_cls}">{badge_txt}</span>
            </div>
            <div style="font-family: monospace; font-size: 0.75rem; color: #94a3b8;">Pod: transformer-worker-v2</div>
            <div style="margin-top: 8px; font-family: monospace; font-size: 0.8rem; color: {sub_color}; font-weight: 600;">
                {sub_txt}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

with col_top3:
    node_name = "Production Database"
    if node_name in st.session_state.active_faults or "database" in st.session_state.active_faults:
        card_cls = "topology-card-critical"
        badge_cls = "status-badge-denied"
        badge_txt = "🔴 CRITICAL FAULT"
        sub_txt = "Vector Dim Mismatch (ABORTED)"
        sub_color = "#f87171"
    else:
        card_cls = "topology-card-healthy"
        badge_cls = "status-badge-healthy"
        badge_txt = "🟢 HEALTHY"
        sub_txt = "Normal (Pool: 64 conn · 0.9ms lat)"
        sub_color = "#34d399"

    st.markdown(
        f"""
        <div class="{card_cls}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <b style="font-size: 0.95rem; color: #f1f5f9;">{node_name}</b>
                <span class="{badge_cls}">{badge_txt}</span>
            </div>
            <div style="font-family: monospace; font-size: 0.75rem; color: #94a3b8;">Cluster: Aurora PG + Qdrant</div>
            <div style="margin-top: 8px; font-family: monospace; font-size: 0.8rem; color: {sub_color}; font-weight: 600;">
                {sub_txt}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

if not is_cluster_healthy:
    broken_names = [NODE_PROFILES[k]["name"] for k in st.session_state.active_faults if k in NODE_PROFILES]
    st.error(f"🚨 **DEMO FAULT STATE**: Sample fault toggled for: {', '.join(broken_names)}. No external service is affected.")
else:
    st.success("✅ **DEMO BASELINE**: No sample fault is selected. These are not live service metrics.")

# ==============================================================================
# 8. NODES ANOMALY DIAGNOSTIC CORE (SELECTBOX / TAB STRIP)
# ==============================================================================
if not is_cluster_healthy:
    st.divider()
    st.subheader("2. Nodes Anomaly Diagnostic Core")
    
    # Ensure selected inspector node exists in active faults
    valid_active = [n for n in st.session_state.active_faults if n in NODE_PROFILES]
    if not valid_active:
        valid_active = ["Data Transformer Node"]
        
    if st.session_state.selected_inspector_node not in valid_active:
        st.session_state.selected_inspector_node = valid_active[0]

    # Selectbox toggle letting operator seamlessly inspect distinct error traces
    selected_node = st.selectbox(
        "Select Impaired Node to Inspect Diagnostic Trace & Payload Diff:",
        options=valid_active,
        format_func=lambda k: f"🚨 {NODE_PROFILES[k]['name']} (Pod: {NODE_PROFILES[k]['pod']})"
    )
    st.session_state.selected_inspector_node = selected_node
    
    current_profile = NODE_PROFILES[selected_node]
    current_incident_id = current_profile.get("ticket_id", f"INC-2026-ACTIVE-{current_profile['key'][:4].upper()}")

    # Display Raw Log for Selected Node
    st.markdown(f"#### 🚨 Raw Stack Trace Log: {current_profile['name']}")
    st.caption(f"Incident ID: {current_incident_id} · Exception: {current_profile['error_type']}")

    terminal_code = f"# Node: {current_profile['name']}\n# Error: {current_profile['error_type']}\n\n{current_profile['traceback']}"
    st.markdown(f'<div class="terminal-box">{terminal_code}</div>', unsafe_allow_html=True)

    # Failed Payload Display
    st.markdown(f"**Failed Payload ({current_profile['name']}):**")
    st.json(current_profile["failed_payload"])

    # Vector Clustering & Root Cause Synthesis for Selected Node
    st.divider()
    st.subheader("3. Vector-Indexed Stack Trace Clustering & Root Cause Synthesis")

    col_sim, col_rca = st.columns([1, 1])

    with col_sim:
        st.markdown(f"**Sample Incidents · Demo Data ({current_profile['name']})**")
        sim_df = pd.DataFrame(current_profile["similar_incidents"])
        st.dataframe(sim_df, use_container_width=True, hide_index=True)

    with col_rca:
        st.markdown(f"**Sample Diagnosis · No Live Model ({current_profile['name']})**")
        st.markdown(
            f"""
            > **Static demo profile**:
            > * **Diagnosis**: {current_profile['diagnosis']}
            > * **Failure Mode**: {current_profile['failure_mode']}
            > * **Remediation Vector**: {current_profile['remediation']}
            > * **Confidence**: Not measured; this is sample text, not a Gemini response.
            """
        )

    # Streamlit demo-only canary animation
    st.divider()
    st.subheader(f"4. Simulated Canary · Demo Only ({current_profile['name']})")

    col_term_ctrl, col_term_view = st.columns([1, 2])

    with col_term_ctrl:
        st.markdown("**Sandbox Execution Control**")
        st.caption(f"Plays a scripted canary animation for {current_profile['name']}; it does not execute service checks.")
        run_canary_btn = st.button("🧪 Play Demo Canary", use_container_width=True)

    with col_term_view:
        terminal_placeholder = st.empty()
        progress_placeholder = st.empty()

        if run_canary_btn:
            logs = []
            steps = [
                (f"[$] Initializing ephemeral sandbox for {current_profile['name']} (ns: algohealer-canary)...", 0.20),
                ("[$] Staging pre-execution memory snapshot & mounting candidate patch payload...", 0.40),
                ("[$] Demo sequence: sample checks shown; no service test was executed...", 0.70),
                ("[$] Regression analysis: Memory leak delta = 0.00%, CPU variance = +0.1%...", 0.90),
                (f"[DEMO] Sample canary animation completed for {current_profile['name']}.\n[INFO] No patch was validated or deployed.", 1.0)
            ]

            for log_text, p_val in steps:
                logs.append(log_text)
                rendered_logs = "\n".join(logs)
                terminal_placeholder.markdown(
                    f'<div class="terminal-box">{rendered_logs}</div>',
                    unsafe_allow_html=True
                )
                progress_placeholder.progress(p_val)
                time.sleep(0.2)

            st.session_state.canary_passed = True
            st.session_state.canary_logs = logs
        elif st.session_state.canary_passed and st.session_state.canary_logs:
            saved_logs = "\n".join(st.session_state.canary_logs)
            terminal_placeholder.markdown(
                f'<div class="terminal-box">{saved_logs}</div>',
                unsafe_allow_html=True
            )
            progress_placeholder.progress(1.0)
        else:
            terminal_placeholder.markdown(
                '<div class="terminal-box">[DEMO] Simulated canary idle. Click "Play Demo Canary" to show the sample sequence.</div>',
                unsafe_allow_html=True
            )

    # Dynamic Line-by-Line Code Diff for Selected Node
    st.divider()
    st.subheader(f"5. Multi-Tiered Governance & Line-by-Line Code Diff: {current_profile['name']}")
    st.warning("⚠️ **Demo decision gate**: These buttons update only this Streamlit session. No live cluster or service is modified.")

    broken_str = json.dumps(current_profile["failed_payload"], indent=2)
    patch_str = json.dumps(current_profile["proposed_patch"], indent=2)

    diff = list(difflib.unified_diff(
        broken_str.splitlines(keepends=True),
        patch_str.splitlines(keepends=True),
        fromfile=f"Broken Payload ({current_profile['name']})",
        tofile=f"Proposed AI Patch (Sanitized)",
        n=3
    ))

    diff_html = ['<div class="diff-container">']
    for line in diff:
        clean_line = line.replace("<", "&lt;").replace(">", "&gt;").rstrip("\n")
        if clean_line.startswith("+") and not clean_line.startswith("+++"):
            diff_html.append(f'<span class="diff-line-added">{clean_line}</span>')
        elif clean_line.startswith("-") and not clean_line.startswith("---"):
            diff_html.append(f'<span class="diff-line-removed">{clean_line}</span>')
        else:
            diff_html.append(f'<span class="diff-line-context">{clean_line}</span>')
    diff_html.append('</div>')

    st.markdown("".join(diff_html), unsafe_allow_html=True)

    # ==============================================================================
    # STRUCTURAL CARD-IMAGE STYLE LIST REPORT (SYSTEM BLUEPRINT CARD)
    # ==============================================================================
    st.markdown(
        """
        <div class="blueprint-image-card">
            <div class="blueprint-card-header">
                <div>
                    <span class="blueprint-badge">SYSTEM BLUEPRINT SPECIFICATION // ARCHITECTURAL AUDIT</span>
                    <h3 style="margin: 6px 0 2px 0; color: #f8fafc; font-size: 1.15rem; font-family: 'JetBrains Mono', monospace;">
                        📐 Structural System Blueprint &amp; Execution Report
                    </h3>
                    <span style="font-size: 0.75rem; color: #38bdf8; font-family: monospace;">
                        STATUS: ACTIVE SRE FAULT MATRIX · HIGH-CONTRAST CONTAINER SPEC
                    </span>
                </div>
                <div style="text-align: right;">
                    <span style="font-family: monospace; font-size: 0.75rem; color: #94a3b8;">
                        IMPAIRED SERVICE VECTORS: {impaired_count}
                    </span>
                </div>
            </div>
        """.replace("{impaired_count}", str(len(valid_active))),
        unsafe_allow_html=True
    )

    # Render List-Formatted Execution Report for every active cluster fault
    for node_item in valid_active:
        prof = NODE_PROFILES[node_item]
        ticket_id = prof.get("ticket_id", f"INC-2026-{prof['pod'][:4].upper()}")
        mutation_sig = prof.get("mutation_signature", f"[{prof['mutation_event']}]")
        impact_bullets = prof.get("os_core_impact", [prof["backend_impact"]])
        remediation_bullets = prof["remediation_vector"]

        impact_items_html = "".join([f"<li style='margin-bottom: 4px;'>{b}</li>" for b in impact_bullets])
        remediation_items_html = "".join([f"<li style='margin-bottom: 4px;'><code>{c}</code></li>" for c in remediation_bullets])

        st.markdown(
            f"""
            <div class="blueprint-report-item">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 8px; margin-bottom: 12px;">
                    <div>
                        <span style="font-weight: 700; font-size: 0.95rem; color: #f1f5f9; font-family: 'JetBrains Mono', monospace;">
                            🏢 {prof['name']}
                        </span>
                        <span style="font-size: 0.75rem; color: #94a3b8; font-family: monospace; margin-left: 8px;">
                            (Pod: {prof['pod']})
                        </span>
                    </div>
                    <span class="mutation-sig-tag">🌋 {mutation_sig}</span>
                </div>
                
                <div style="margin-bottom: 10px;">
                    <b style="color: #38bdf8; font-family: monospace; font-size: 0.85rem;">🆔 Incident Ticket ID:</b>
                    <code style="background: #0f172a; color: #38bdf8; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155; margin-left: 6px; font-weight: 700;">
                        {ticket_id}
                    </code>
                </div>

                <div style="margin-bottom: 12px;">
                    <b style="color: #f87171; font-family: monospace; font-size: 0.85rem;">💥 OS Core Impact Profile:</b>
                    <ul style="margin: 6px 0 0 16px; padding: 0; color: #cbd5e1; font-size: 0.82rem; line-height: 1.5;">
                        {impact_items_html}
                    </ul>
                </div>

                <div>
                    <b style="color: #34d399; font-family: monospace; font-size: 0.85rem;">🛡️ Programmatic Remediation Vector:</b>
                    <ol style="margin: 6px 0 0 16px; padding: 0; color: #93c5fd; font-family: monospace; font-size: 0.8rem; line-height: 1.5;">
                        {remediation_items_html}
                    </ol>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown("</div>", unsafe_allow_html=True)

    # Governance Decision Buttons (Heals All Active Impaired Nodes ONLY ON APPROVE)
    st.markdown("#### Demo Operator Decision")
    col_act1, col_act2 = st.columns([1, 1])

    with col_act1:
        approve_btn = st.button("🚀 Run Simulated Recovery · Demo", type="primary", use_container_width=True)
    with col_act2:
        reject_btn = st.button("🛑 Reject Demo Patch", type="secondary", use_container_width=True)

    if approve_btn:
        healed_count = len(st.session_state.active_faults)
        current_event_time = time.time()

        with st.status("Playing simulated recovery sequence...", expanded=True) as status_box:
            st.write("1/4: Showing a sample snapshot identifier (no system snapshot is created)...")
            time.sleep(0.3)
            st.write(f"2/4: Simulating a patch animation for {healed_count} selected demo node(s)...")
            time.sleep(0.4)
            st.write("3/4: Showing sample checks; no service health is verified...")
            time.sleep(0.3)
            st.write("4/4: Updating this Streamlit session's demo history and clearing its demo fault flags...")
            time.sleep(0.3)
            status_box.update(label="Demo sequence complete · not a verified recovery", state="complete", expanded=False)

        # Update Snapshot and MTTR States
        snap_hash = f"0x{int(current_event_time):x}a8e"
        st.session_state.snapshot_taken = True
        st.session_state.snapshot_hash = snap_hash
        st.session_state.mttr_display = "sample only"
        st.session_state.canary_passed = False
        st.session_state.canary_logs = []

        # Reset stage to NOMINAL and clear rejection state
        st.session_state.current_stage = "NOMINAL"
        st.session_state.rejection_occurred = False
        st.session_state.rejection_message = None

        # REAL-TIME TIME-ELAPSED STREAMING: DYNAMICALLY PREPEND EACH RECORD INTO HISTORY LOG
        for node_key in st.session_state.active_faults:
            if node_key in NODE_PROFILES:
                prof = NODE_PROFILES[node_key]
                varied_duration = f"{round(random.uniform(11.20, 12.85), 2)}s"
                resolved_entry = {
                    "Incident Ticket ID": f"INC-2026-{int(current_event_time)}-{prof['pod'][:4].upper()}",
                    "Node": prof["name"],
                    "timestamp_epoch": current_event_time,
                    "Remediation Duration": varied_duration,
                    "Result": "Simulated demo action",
                    "Status": "DEMO · not verified"
                }
                # Dynamic Prepend into array
                st.session_state.resolved_incidents_log.insert(0, resolved_entry)

        # Sync mirror
        st.session_state.incident_history = st.session_state.resolved_incidents_log

        # Clear active faults
        st.session_state.active_faults = []
        st.rerun()

    # CRITICAL BUGFIX: If user clicks Reject, do NOT clear active_faults or heal system!
    if reject_btn:
        st.session_state.current_stage = "FAULT_ACTIVE"
        st.session_state.canary_passed = False
        st.session_state.canary_logs = []
        st.session_state.rejection_occurred = True
        st.session_state.rejection_message = (
            "🛑 Demo patch rejected. The selected demo fault remains active in this Streamlit session. "
            "No real service was changed."
        )
        st.rerun()

# ==============================================================================
# 9. DEEP-SYSTEM BACKEND ATTACK & REMEDIATION AUDIT LEDGER
# ==============================================================================
st.divider()
st.subheader("🧠 Demo Incident & Remediation Ledger")

if not is_cluster_healthy:
    st.caption("Deep-system architectural inspection of mutation signatures, memory anomalies, and remediation vectors.")
    active_keys = [k for k in st.session_state.active_faults if k in NODE_PROFILES]
    tab_labels = [f"🚨 {NODE_PROFILES[k]['name']}" for k in active_keys]
    if active_keys:
        ledger_tabs = st.tabs(tab_labels)

        for idx, key in enumerate(active_keys):
            prof = NODE_PROFILES[key]
            with ledger_tabs[idx]:
                col_l1, col_l2 = st.columns([1, 1])

                with col_l1:
                    st.markdown("**1. Raw System Mutation Event**")
                    st.markdown(
                        f'<span class="mutation-sig-tag">⚡ {prof["mutation_signature"]}</span>',
                        unsafe_allow_html=True
                    )
                    st.caption(f"Target Pod: `{prof['pod']}` · Signal Exception: `{prof['error_type']}`")

                    st.markdown("**2. Internal Backend Engine Impact**")
                    st.markdown(
                        f"""
                        <div style="background-color: rgba(239, 68, 68, 0.12); border-left: 3px solid #ef4444; padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; color: #fca5a5; line-height: 1.5;">
                            {prof['backend_impact']}
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

                with col_l2:
                    st.markdown("**3. Automated Remediation Action Vector**")
                    st.caption("Sample remediation text · not executed by this Streamlit prototype:")
                    for step in prof["remediation_vector"]:
                        st.markdown(
                            f'<div class="ledger-action-step">{step}</div>',
                            unsafe_allow_html=True
                        )
                    st.markdown(
                        '<span style="color: #fbbf24; font-size: 0.75rem; font-family: monospace;">DEMO DATA · no canary verification was run</span>',
                        unsafe_allow_html=True
                    )
else:
    st.info(
        "🟢 **Demo Ledger** — No sample faults are selected. Service health, memory tables, buffers, and indexes are not connected or measured."
    )

# ==============================================================================
# 10. POST-RECOVERY AUDIT TRAIL & SNAPSHOT GUARD CONFIRMATION
# ==============================================================================
if st.session_state.snapshot_taken and is_cluster_healthy:
    st.success(
        f"🧪 **Sample snapshot label** (`{st.session_state.snapshot_hash}`). "
        "The Streamlit demo state was reset; no service snapshot or recovery verification occurred."
    )

st.subheader("7. Demo Incident History · Session Data")

# Dynamic Time-Elapsed Table Rendering
rendered_history = []
for entry in st.session_state.resolved_incidents_log:
    ticket_val = entry.get("Incident Ticket ID") or entry.get("Incident ID", "INC-2026-VAL")
    epoch_val = entry.get("timestamp_epoch", time.time())
    rendered_history.append({
        "Incident Ticket ID": ticket_val,
        "Node": entry["Node"],
        "Time Elapsed": format_time_elapsed(epoch_val),
        "Remediation Duration": entry["Remediation Duration"],
        "Result": entry["Result"],
        "Status": entry["Status"]
    })

audit_df = pd.DataFrame(rendered_history)
st.dataframe(audit_df, use_container_width=True, hide_index=True)

# ==============================================================================
# FOOTER
# ==============================================================================
st.divider()
footer_cluster_status = "💥 IMPAIRED" if not is_cluster_healthy else "✅ ACTIVE-OPTIMAL"
st.caption(
    f"AlgoHealer Streamlit demo · Session: {st.session_state.auth_user} · "
    f"Demo state: {footer_cluster_status} · Sample incident count: {total_incidents_healed} · No SLA or production connection"
)
