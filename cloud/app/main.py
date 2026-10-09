"""
KitaPH Cloud — the optional, secondary part of KitaPH.

The app's AI runs on the phone (and on the user's own laptop hub). This service only:
  1. serves refreshed reference data (BSP exchange rates, PSA/DOLE figures) when the phone is online, and
  2. stores end-to-end encrypted backups. The phone encrypts before upload; this server and Supabase
     only ever see ciphertext and cannot read anyone's finances.

Everything keeps working without it.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
MAX_CIPHERTEXT_CHARS = 2_000_000

app = FastAPI(title="KitaPH Cloud", version="1.0.0", docs_url="/docs")
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
    return {"ok": True, "supabase": supabase_configured()}


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
                return {"asOf": rows[0]["as_of"], **rows[0]["payload"], "from": "supabase"}
        except httpx.HTTPError:
            pass
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


async def _user_id(authorization: str | None) -> tuple[str, str]:
    if not supabase_configured():
        raise HTTPException(503, "Cloud backup is not configured on this server.")
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
    user_id, jwt = await _user_id(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{SUPABASE_URL}/rest/v1/backups", params={"user_id": f"eq.{user_id}", "select": "*"}, headers=_headers(jwt))
    rows = r.json() if r.status_code == 200 else []
    if not rows:
        raise HTTPException(404, "No backup yet.")
    return rows[0]


@app.delete("/v1/backup")
async def delete_backup(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user_id, jwt = await _user_id(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await client.delete(f"{SUPABASE_URL}/rest/v1/backups", params={"user_id": f"eq.{user_id}"}, headers=_headers(jwt))
    return {"ok": True}
