"""
SQLite store for LakbayMate Cloud, used when Supabase is not configured (and as a cache when it is).

- reference_cache: the latest reference data fetched from Supabase, served if Supabase is unreachable.
- backups: end-to-end encrypted backups keyed by the SHA-256 of a device secret (the server never
  sees the secret or the plaintext). With Supabase configured, backups go to Supabase instead.

On Render's free plan the disk is reset on redeploy, so SQLite data there is a cache, not a vault.
Set LAKBAYMATE_DB to a persistent disk path to keep it.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

DB_PATH = os.getenv("LAKBAYMATE_DB", "lakbaymate.db")

SCHEMA = """
create table if not exists reference_cache (
  id integer primary key autoincrement,
  as_of text not null,
  payload text not null,
  fetched_at text not null
);
create table if not exists backups (
  owner_hash text primary key,
  ciphertext text not null,
  nonce text not null,
  salt text not null,
  kdf text not null,
  iterations integer not null,
  cipher text not null,
  version integer not null default 1,
  updated_at text not null
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def owner_hash(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def cache_reference(as_of: str, payload: dict[str, Any]) -> None:
    with connect() as c:
        c.execute("insert into reference_cache (as_of, payload, fetched_at) values (?, ?, ?)", (as_of, json.dumps(payload), now()))
        c.execute("delete from reference_cache where id not in (select id from reference_cache order by id desc limit 5)")


def cached_reference() -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute("select as_of, payload, fetched_at from reference_cache order by id desc limit 1").fetchone()
    if not row:
        return None
    return {"asOf": row["as_of"], **json.loads(row["payload"]), "cachedAt": row["fetched_at"]}


def save_backup(secret: str, backup: dict[str, Any]) -> None:
    with connect() as c:
        c.execute(
            """insert into backups (owner_hash, ciphertext, nonce, salt, kdf, iterations, cipher, version, updated_at)
               values (:owner_hash, :ciphertext, :nonce, :salt, :kdf, :iterations, :cipher, :version, :updated_at)
               on conflict(owner_hash) do update set ciphertext = excluded.ciphertext, nonce = excluded.nonce,
                 salt = excluded.salt, kdf = excluded.kdf, iterations = excluded.iterations, cipher = excluded.cipher,
                 version = excluded.version, updated_at = excluded.updated_at""",
            {**backup, "owner_hash": owner_hash(secret), "updated_at": now()},
        )


def load_backup(secret: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute("select * from backups where owner_hash = ?", (owner_hash(secret),)).fetchone()
    if not row:
        return None
    data = dict(row)
    data.pop("owner_hash")
    return data


def delete_backup(secret: str) -> None:
    with connect() as c:
        c.execute("delete from backups where owner_hash = ?", (owner_hash(secret),))


def counts() -> dict[str, int]:
    with connect() as c:
        return {
            "referenceCache": c.execute("select count(*) from reference_cache").fetchone()[0],
            "backups": c.execute("select count(*) from backups").fetchone()[0],
        }
