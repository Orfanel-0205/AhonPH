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


def test_backup_requires_configuration(monkeypatch):
    monkeypatch.setattr(main, "SUPABASE_URL", "")
    r = client.get("/v1/backup", headers={"Authorization": "Bearer x"})
    assert r.status_code == 503


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
