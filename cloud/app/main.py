"""
LakbayMate Cloud — the optional, secondary part of LakbayMate.

The app's AI runs on the phone (and on the user's own laptop hub). This service only:
  1. serves refreshed reference data (BSP exchange rates, PSA/DOLE figures) when the phone is online, and
  2. stores end-to-end encrypted backups. The phone encrypts before upload; this server and Supabase
     only ever see ciphertext and cannot read anyone's finances.

Storage: Supabase (Postgres, Auth, row-level security) when SUPABASE_URL and SUPABASE_ANON_KEY are set;
otherwise SQLite (app/db.py), which also caches reference data in case Supabase is unreachable.

Everything keeps working without it.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import db

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
MAX_CIPHERTEXT_CHARS = 2_000_000

app = FastAPI(title="LakbayMate Cloud", version="1.0.0", docs_url="/docs")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "PUT", "DELETE"], allow_headers=["*"])

# Same figures the app bundles (src/lib/econ.ts, src/lib/rates.ts). Supabase rows override these when present.
BUNDLED_REFERENCE: dict[str, Any] = {
    "asOf": "2026-10-08",
    "econ": [
        {"id": "headlineInflation", "value": 7.2, "unit": "pct", "period": "September 2026", "source": "PSA"},
        {"id": "foodInflation", "value": 6.8, "unit": "pct", "period": "September 2026", "source": "PSA"},
        {"id": "riceInflation", "value": 20.3, "unit": "pct", "period": "September 2026", "source": "PSA"},
        {"id": "transportInflation", "value": 14.6, "unit": "pct", "period": "September 2026", "source": "PSA"},
        {"id": "utilitiesInflation", "value": 8.4, "unit": "pct", "period": "September 2026", "source": "PSA"},
        {"id": "ncrMinWage", "value": 755, "unit": "php_per_day", "period": "Effective September 26, 2026", "source": "DOLE NWPC, Wage Order NCR-28"},
    ],
    "fx": {
        "source": "BSP Reference Exchange Rate Bulletin (Oct 8, 2026)",
        "phpPerUnit": {
            "USD": 62.766, "EUR": 70.2916, "JPY": 0.3972, "KRW": 0.04689, "CNY": 9.361, "GBP": 82.9704,
            "AUD": 43.6851, "SGD": 49.0627, "HKD": 7.9985, "CAD": 44.0247, "TWD": 1.9711,
        },
    },
}


def supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY)


def _headers(user_jwt: str | None = None) -> dict[str, str]:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {user_jwt or SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "supabase": supabase_configured(), "storage": "supabase" if supabase_configured() else "sqlite", "sqlite": db.counts()}


@app.get("/v1/reference")
async def reference() -> dict[str, Any]:
    """Latest reference data. Falls back to the bundled copy if Supabase is not set up or unreachable."""
    if supabase_configured():
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    f"{SUPABASE_URL}/rest/v1/reference_data",
                    params={"select": "as_of,payload", "order": "as_of.desc", "limit": "1"},
                    headers=_headers(),
                )
            rows = r.json() if r.status_code == 200 else []
            if rows:
                db.cache_reference(rows[0]["as_of"], rows[0]["payload"])
                return {"asOf": rows[0]["as_of"], **rows[0]["payload"], "from": "supabase"}
        except httpx.HTTPError:
            pass
        # Supabase unreachable: the last copy we fetched, from SQLite.
        cached = db.cached_reference()
        if cached:
            return {**cached, "from": "sqlite-cache"}
    return {**BUNDLED_REFERENCE, "from": "bundled"}


class EncryptedBackup(BaseModel):
    """Opaque, client-encrypted blob. The server cannot decrypt it."""

    ciphertext: str = Field(min_length=1, max_length=MAX_CIPHERTEXT_CHARS)
    nonce: str = Field(min_length=8, max_length=200)
    salt: str = Field(min_length=8, max_length=200)
    kdf: Literal["pbkdf2-sha256"]
    iterations: int = Field(ge=100_000, le=10_000_000)
    cipher: Literal["xchacha20-poly1305"]
    version: int = 1


def _device_secret(authorization: str | None) -> str:
    """SQLite mode: a random secret generated on the phone (at least 32 characters) owns the backup."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Send your device backup key as a Bearer token.")
    secret = authorization.split(" ", 1)[1].strip()
    if len(secret) < 32:
        raise HTTPException(401, "The device backup key must be at least 32 characters.")
    return secret


async def _user_id(authorization: str | None) -> tuple[str, str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to use cloud backup.")
    jwt = authorization.split(" ", 1)[1]
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=_headers(jwt))
    if r.status_code != 200:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    return r.json()["id"], jwt


@app.put("/v1/backup")
async def put_backup(body: EncryptedBackup, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not supabase_configured():
        db.save_backup(_device_secret(authorization), body.model_dump())
        return {"ok": True, "storage": "sqlite"}
    user_id, jwt = await _user_id(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/backups",
            params={"on_conflict": "user_id"},
            headers={**_headers(jwt), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json={"user_id": user_id, **body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()},
        )
    if r.status_code not in (200, 201, 204):
        raise HTTPException(502, "Could not save the backup.")
    return {"ok": True}


@app.get("/v1/backup")
async def get_backup(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not supabase_configured():
        row = db.load_backup(_device_secret(authorization))
        if not row:
            raise HTTPException(404, "No backup yet.")
        return row
    user_id, jwt = await _user_id(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{SUPABASE_URL}/rest/v1/backups", params={"user_id": f"eq.{user_id}", "select": "*"}, headers=_headers(jwt))
    rows = r.json() if r.status_code == 200 else []
    if not rows:
        raise HTTPException(404, "No backup yet.")
    return rows[0]


@app.delete("/v1/backup")
async def delete_backup(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not supabase_configured():
        db.delete_backup(_device_secret(authorization))
        return {"ok": True, "storage": "sqlite"}
    user_id, jwt = await _user_id(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/backups", params={"user_id": f"eq.{user_id}"}, headers=_headers(jwt))
    return {"ok": True}


REPO_URL = os.getenv("LAKBAYMATE_REPO_URL", "https://github.com/Orfanel-0205/AhonPH")


@app.get("/", response_class=HTMLResponse)
def home() -> str:
    """A live page for judges: what LakbayMate is and what this server does (and doesn't do)."""
    storage = "Supabase (Postgres + Auth + row-level security)" if supabase_configured() else "SQLite on this server"
    counts = db.counts()
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LakbayMate Cloud</title><style>
body{{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f4;color:#17201c}}
header{{background:linear-gradient(160deg,#0b5c45,#0f7a5c);color:#fff;padding:48px 20px}}
.wrap{{max-width:760px;margin:0 auto}} h1{{margin:0;font-size:40px}} .tag{{color:#d2ece2;font-size:18px;margin-top:6px}}
.pill{{display:inline-block;background:#e8a93a;color:#0b5c45;font-weight:700;border-radius:999px;padding:4px 12px;margin-top:16px}}
main{{padding:24px 20px}} .card{{background:#fff;border:1px solid #e7ece5;border-radius:18px;padding:20px;margin-bottom:16px;box-shadow:0 4px 12px rgba(11,61,46,.07)}}
h2{{margin:0 0 8px;font-size:20px}} code{{background:#eef1ec;padding:2px 6px;border-radius:6px}} a{{color:#0b5c45;font-weight:600}}
td{{padding:6px 10px 6px 0;vertical-align:top}} .ok{{color:#1a7f4b;font-weight:700}}
</style></head><body>
<header><div class="wrap"><h1>LakbayMate</h1><div class="tag">Your Smart Travel Companion · for Filipinos traveling and working abroad</div>
<span class="pill">The AI runs on the phone. This server is optional.</span></div></header>
<main class="wrap">
<div class="card"><h2>What LakbayMate does, offline</h2>
Talk with locals in natural Japanese, Korean or Chinese (Gemini Nano), scan menus and receipts in any script (ML Kit),
split a bill by saying who had what, plan a Tipid / Sakto / Bongga trip, and keep a live trip budget, all in airplane mode.
The app's AI Lab runs 10 on-device AI steps and shows Android's count of bytes sent: 0.</div>
<div class="card"><h2>What this cloud does</h2><table>
<tr><td class="ok">Live</td><td>This server is running on Render.</td></tr>
<tr><td><b>Storage</b></td><td>{storage}. SQLite rows: {counts["referenceCache"]} cached reference sets, {counts["backups"]} encrypted backups.</td></tr>
<tr><td><b>Reference data</b></td><td><a href="/v1/reference">/v1/reference</a>: BSP exchange rates and PSA/DOLE figures for the phone to refresh when online.</td></tr>
<tr><td><b>Backups</b></td><td><code>PUT/GET/DELETE /v1/backup</code>: end-to-end encrypted on the phone; the server stores ciphertext only.</td></tr>
<tr><td><b>Never</b></td><td>No AI runs here, and no translations, receipts, messages or spending are sent here.</td></tr>
</table></div>
<div class="card"><h2>Links</h2><a href="/docs">API docs (OpenAPI)</a> · <a href="/health">/health</a> · <a href="{REPO_URL}">Source on GitHub</a></div>
<p style="color:#5d6a63">Built for the AppBuildersPH Hackathon 2026 (Local AI).</p>
</main></body></html>"""
