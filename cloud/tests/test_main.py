from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)


def test_health_reports_supabase_state():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_reference_falls_back_to_bundled_data_without_supabase(monkeypatch):
    monkeypatch.setattr(main, "SUPABASE_URL", "")
    r = client.get("/v1/reference")
    body = r.json()
    assert r.status_code == 200
    assert body["from"] == "bundled"
    assert body["fx"]["phpPerUnit"]["USD"] == 62.766
    assert {e["id"]: e["value"] for e in body["econ"]}["headlineInflation"] == 7.2


def test_backup_without_supabase_uses_sqlite(monkeypatch, tmp_path):
    from app import db

    monkeypatch.setattr(main, "SUPABASE_URL", "")
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.db"))
    key = {"Authorization": "Bearer " + "k" * 40}
    assert client.get("/v1/backup", headers={"Authorization": "Bearer short"}).status_code == 401
    assert client.get("/v1/backup", headers=key).status_code == 404
    blob = {"ciphertext": "abc", "nonce": "n" * 24, "salt": "s" * 16, "kdf": "pbkdf2-sha256", "iterations": 210000, "cipher": "xchacha20-poly1305"}
    assert client.put("/v1/backup", json=blob, headers=key).json()["storage"] == "sqlite"
    assert client.get("/v1/backup", headers=key).json()["ciphertext"] == "abc"
    assert client.delete("/v1/backup", headers=key).status_code == 200
    assert client.get("/v1/backup", headers=key).status_code == 404


def test_home_page_is_live(monkeypatch, tmp_path):
    from app import db

    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.db"))
    r = client.get("/")
    assert r.status_code == 200
    assert "LakbayMate" in r.text and "No AI runs here" in r.text


def test_backup_requires_sign_in(monkeypatch):
    monkeypatch.setattr(main, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main, "SUPABASE_ANON_KEY", "anon")
    assert client.get("/v1/backup").status_code == 401


def test_backup_rejects_unencrypted_payloads(monkeypatch):
    monkeypatch.setattr(main, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main, "SUPABASE_ANON_KEY", "anon")
    plaintext = {"transactions": [{"amount": 1850}]}
    r = client.put("/v1/backup", json=plaintext, headers={"Authorization": "Bearer x"})
    assert r.status_code == 422
