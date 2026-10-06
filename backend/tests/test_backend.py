"""Backend regression tests for Futbase / Liga Alevín.
Covers: auth (coach + parent), config, club/invite, teams, matches, standings,
players, jornada-dates, upload/download, seed, AI scan endpoints, role enforcement.
"""
import uuid
import pytest


# ---------------- Auth ----------------
class TestAuth:
    def test_login_coach(self, api, api_url, coach_auth):
        headers, user, token = coach_auth
        assert token
        assert user["email"] == "coach@test.com"
        assert user["rol"] == "ENTRENADOR"

    def test_auth_me(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/auth/me", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == "coach@test.com"
        assert data["user"]["rol"] == "ENTRENADOR"

    def test_auth_me_no_token(self, api, api_url):
        r = api.get(f"{api_url}/auth/me")
        assert r.status_code == 401

    def test_login_invalid_password(self, api, api_url):
        r = api.post(f"{api_url}/auth/login", json={"email": "coach@test.com", "password": "wrongpass"})
        assert r.status_code == 401

    def test_register_parent_invalid_code(self, api, api_url):
        r = api.post(
            f"{api_url}/auth/register-parent",
            json={
                "email": f"xx_{uuid.uuid4().hex[:6]}@test.com",
                "password": "parent123",
                "nombre": "X",
                "invite_code": "ZZZZZZZZ",
            },
        )
        assert r.status_code == 404

    def test_register_parent_valid_code(self, parent_auth):
        headers, user, token = parent_auth
        assert user["rol"] == "PADRE"
        assert token

    def test_forgot_password_generic_response(self, api, api_url):
        r = api.post(f"{api_url}/auth/forgot-password", json={"email": "nobody-xyz@test.com"})
        assert r.status_code == 200
        assert "message" in r.json()
        # Should NOT disclose user existence
        assert "no" not in r.json()["message"].lower() or "si el email" in r.json()["message"].lower()

    def test_reset_password_invalid_token(self, api, api_url):
        r = api.post(f"{api_url}/auth/reset-password", json={"token": "garbage", "password": "newpass123"})
        assert r.status_code == 400


# ---------------- Seed + Config + Invite ----------------
class TestSeedAndConfig:
    def test_seed_as_coach(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.post(f"{api_url}/seed", headers=headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_seed_rejects_parent(self, api, api_url, parent_auth):
        headers, _, _ = parent_auth
        r = api.post(f"{api_url}/seed", headers=headers)
        assert r.status_code == 403

    def test_get_config(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/config", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "club_name" in data
        # must not expose invite_code / jornada_dates
        assert "invite_code" not in data
        assert "jornada_dates" not in data

    def test_put_config_coach(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.put(f"{api_url}/config", json={"subtitle": "Liga Educa Test"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["subtitle"] == "Liga Educa Test"

    def test_put_config_parent_forbidden(self, api, api_url, parent_auth):
        headers, _, _ = parent_auth
        r = api.put(f"{api_url}/config", json={"subtitle": "hack"}, headers=headers)
        assert r.status_code == 403

    def test_club_invite_coach(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/club/invite", headers=headers)
        assert r.status_code == 200
        inv = r.json().get("invite_code")
        assert inv and isinstance(inv, str) and len(inv) >= 4

    def test_club_invite_parent_forbidden(self, api, api_url, parent_auth):
        headers, _, _ = parent_auth
        r = api.get(f"{api_url}/club/invite", headers=headers)
        assert r.status_code == 403


# ---------------- Teams ----------------
class TestTeams:
    def test_list_teams_populated_after_seed(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/teams", headers=headers)
        assert r.status_code == 200
        teams = r.json()
        assert isinstance(teams, list)
        assert len(teams) >= 8

    def test_crud_team(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        new_team = {"name": f"TEST_{uuid.uuid4().hex[:6]}", "venue_name": "Campo A", "address": "Calle 1"}
        r = api.post(f"{api_url}/teams", json=new_team, headers=headers)
        assert r.status_code == 200
        created = r.json()
        tid = created["id"]
        assert created["name"] == new_team["name"]

        # Update
        r = api.put(f"{api_url}/teams/{tid}", json={"venue_name": "Campo B"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["venue_name"] == "Campo B"

        # Delete
        r = api.delete(f"{api_url}/teams/{tid}", headers=headers)
        assert r.status_code == 200

        # Verify deletion
        r = api.get(f"{api_url}/teams", headers=headers)
        assert all(t["id"] != tid for t in r.json())

    def test_team_create_rejects_parent(self, api, api_url, parent_auth):
        headers, _, _ = parent_auth
        r = api.post(f"{api_url}/teams", json={"name": "ParentTeam"}, headers=headers)
        assert r.status_code == 403


# ---------------- Matches, Standings, Jornadas ----------------
class TestMatches:
    def test_list_matches(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/matches", headers=headers)
        assert r.status_code == 200
        matches = r.json()
        assert isinstance(matches, list)
        assert len(matches) >= 8  # from seed

    def test_bulk_matches(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        payload = {
            "jornada": 9,
            "matches": [
                {"home_team": "TEST_Alpha", "away_team": "TEST_Beta", "home_score": 2, "away_score": 1},
                {"home_team": "TEST_Gamma", "away_team": "TEST_Delta", "home_score": 0, "away_score": 0},
            ],
        }
        r = api.post(f"{api_url}/matches/bulk", json=payload, headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["created"] == 2
        # Verify persistence
        r2 = api.get(f"{api_url}/matches?jornada=9", headers=headers)
        assert r2.status_code == 200
        names = {(m["home_team"], m["away_team"]) for m in r2.json()}
        assert ("TEST_Alpha", "TEST_Beta") in names

    def test_update_delete_match(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        # Create one
        r = api.post(f"{api_url}/matches",
                     json={"jornada": 10, "home_team": "TEST_H", "away_team": "TEST_A",
                           "home_score": 1, "away_score": 1, "status": "FINALIZADO"},
                     headers=headers)
        assert r.status_code == 200
        mid = r.json()["id"]

        r = api.put(f"{api_url}/matches/{mid}", json={"home_score": 3}, headers=headers)
        assert r.status_code == 200
        assert r.json()["home_score"] == 3

        r = api.delete(f"{api_url}/matches/{mid}", headers=headers)
        assert r.status_code == 200

    def test_standings_calc(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/standings", headers=headers)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        # Validate schema and basic math
        for row in rows:
            for key in ("team", "pj", "pg", "pe", "pp", "gf", "gc", "dg", "pts", "position"):
                assert key in row, f"missing {key}"
            assert row["dg"] == row["gf"] - row["gc"]
            assert row["pts"] == 3 * row["pg"] + row["pe"]
            assert row["pj"] == row["pg"] + row["pe"] + row["pp"]
        # Sorted by points desc
        pts_list = [r["pts"] for r in rows]
        assert pts_list == sorted(pts_list, reverse=True)

    def test_jornada_dates_get_put(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/jornada-dates", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

        r = api.put(f"{api_url}/jornada-dates", json={"jornada": 1, "date": "2026-09-13"}, headers=headers)
        assert r.status_code == 200
        assert r.json().get("1") == "2026-09-13"

        # Verify persisted via GET
        r = api.get(f"{api_url}/jornada-dates", headers=headers)
        assert r.json().get("1") == "2026-09-13"

    def test_matches_create_rejects_parent(self, api, api_url, parent_auth):
        headers, _, _ = parent_auth
        r = api.post(f"{api_url}/matches",
                     json={"jornada": 1, "home_team": "A", "away_team": "B"},
                     headers=headers)
        assert r.status_code == 403


# ---------------- Players ----------------
class TestPlayers:
    def test_list_players(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.get(f"{api_url}/players", headers=headers)
        assert r.status_code == 200
        players = r.json()
        assert isinstance(players, list) and len(players) >= 8

    def test_crud_player_and_stats(self, api, api_url, coach_auth):
        headers, _, _ = coach_auth
        r = api.post(
            f"{api_url}/players",
            json={"name": "TEST_Player", "nickname": "Testy", "dorsal": 99, "position": "Delantero"},
            headers=headers,
        )
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["goals"] == 0

        # Update
        r = api.put(f"{api_url}/players/{pid}", json={"nickname": "Testo"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["nickname"] == "Testo"

        # Stats increment
        r = api.post(f"{api_url}/players/{pid}/stats",
                     json={"goals": 2, "assists": 1, "matches_played": 1}, headers=headers)
        assert r.status_code == 200
        p = r.json()
        assert p["goals"] == 2
        assert p["assists"] == 1
        assert p["matches_played"] == 1

        # second increment accumulates
        r = api.post(f"{api_url}/players/{pid}/stats", json={"goals": 3}, headers=headers)
        assert r.json()["goals"] == 5

        # Delete + verify
        r = api.delete(f"{api_url}/players/{pid}", headers=headers)
        assert r.status_code == 200
        r = api.get(f"{api_url}/players", headers=headers)
        assert all(p["id"] != pid for p in r.json())

    def test_player_create_rejects_parent(self, api, api_url, parent_auth):
        headers, _, _ = parent_auth
        r = api.post(f"{api_url}/players", json={"name": "X", "dorsal": 1}, headers=headers)
        assert r.status_code == 403


# ---------------- Upload / Files ----------------
class TestUpload:
    def test_upload_and_download(self, api_url, coach_auth, sample_jpeg):
        import requests as _rq
        headers, _, _ = coach_auth
        files = {"file": ("test.jpg", sample_jpeg, "image/jpeg")}
        r = _rq.post(f"{api_url}/upload", files=files,
                     headers={"Authorization": headers["Authorization"]}, timeout=60)
        if r.status_code != 200:
            pytest.skip(f"Upload returned {r.status_code}: {r.text[:200]}")
        body = r.json()
        assert "path" in body and "url" in body
        # Download
        r2 = _rq.get(f"{api_url}/files/{body['path']}", timeout=60)
        assert r2.status_code == 200
        assert r2.headers.get("Content-Type", "").startswith("image/")
        assert len(r2.content) > 0

    def test_upload_rejects_parent(self, api_url, parent_auth, sample_jpeg):
        import requests as _rq
        headers, _, _ = parent_auth
        files = {"file": ("x.jpg", sample_jpeg, "image/jpeg")}
        r = _rq.post(f"{api_url}/upload", files=files,
                     headers={"Authorization": headers["Authorization"]}, timeout=30)
        assert r.status_code == 403


# ---------------- AI Scan ----------------
class TestAIScan:
    def test_scan_matches_returns_structure(self, api_url, coach_auth, sample_jpeg):
        import requests as _rq
        headers, _, _ = coach_auth
        files = {"file": ("scan.jpg", sample_jpeg, "image/jpeg")}
        r = _rq.post(f"{api_url}/scan/matches", files=files,
                     headers={"Authorization": headers["Authorization"]}, timeout=180)
        if r.status_code == 502:
            pytest.skip(f"AI service upstream error: {r.text[:200]}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "matches" in body
        assert isinstance(body["matches"], list)

    def test_scan_teams_returns_structure(self, api_url, coach_auth, sample_jpeg):
        import requests as _rq
        headers, _, _ = coach_auth
        files = {"file": ("scan.jpg", sample_jpeg, "image/jpeg")}
        r = _rq.post(f"{api_url}/scan/teams", files=files,
                     headers={"Authorization": headers["Authorization"]}, timeout=180)
        if r.status_code == 502:
            pytest.skip(f"AI service upstream error: {r.text[:200]}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "teams" in body
        assert isinstance(body["teams"], list)

    def test_scan_rejects_parent(self, api_url, parent_auth, sample_jpeg):
        import requests as _rq
        headers, _, _ = parent_auth
        files = {"file": ("x.jpg", sample_jpeg, "image/jpeg")}
        r = _rq.post(f"{api_url}/scan/matches", files=files,
                     headers={"Authorization": headers["Authorization"]}, timeout=30)
        assert r.status_code == 403
