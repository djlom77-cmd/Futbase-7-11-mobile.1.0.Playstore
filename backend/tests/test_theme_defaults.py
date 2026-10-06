"""Theme / default config regression — iteration 3.

Validates the new DEFAULT_CLUB_CONFIG:
- A freshly registered club returns theme_preset='futbase_oro' and dark_mode=True on GET /api/config.
- Coach can PUT /api/config to persist that same payload (and null custom_colors).
- Parent (PADRE) is forbidden from PUT /api/config.
- Invite code / register-parent flow works end-to-end.
- Login regression for the fixed coach@test.com/test123.
"""
import uuid
import pytest


@pytest.fixture(scope="module")
def fresh_coach(api, api_url):
    """Register a brand-new coach so DEFAULT_CLUB_CONFIG is applied verbatim."""
    email = f"coach_theme_{uuid.uuid4().hex[:8]}@test.com"
    r = api.post(
        f"{api_url}/auth/register-coach",
        json={
            "email": email,
            "password": "coach123",
            "nombre": "Coach Theme",
            "club_name": "Club Theme Test",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["rol"] == "ENTRENADOR"
    return {"Authorization": f"Bearer {data['token']}"}, data["user"], data["token"], email


class TestNewCoachFlow:
    def test_register_coach_returns_token_and_role(self, fresh_coach):
        headers, user, token, _ = fresh_coach
        assert token and isinstance(token, str)
        assert user["rol"] == "ENTRENADOR"
        assert user["equipo_id"]

    def test_auth_me_200_for_fresh_coach(self, api, api_url, fresh_coach):
        headers, user, _, _ = fresh_coach
        r = api.get(f"{api_url}/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["user"]["rol"] == "ENTRENADOR"
        assert r.json()["user"]["id"] == user["id"]

    def test_default_config_is_futbase_oro_dark(self, api, api_url, fresh_coach):
        """CRITICAL: new default theme must be futbase_oro with dark_mode=True."""
        headers, _, _, _ = fresh_coach
        r = api.get(f"{api_url}/config", headers=headers)
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["theme_preset"] == "futbase_oro", f"got {cfg.get('theme_preset')!r}"
        assert cfg["dark_mode"] is True, f"got dark_mode={cfg.get('dark_mode')!r}"
        # custom_colors default should be null
        assert cfg.get("custom_colors") is None
        # Must still hide private fields
        assert "invite_code" not in cfg
        assert "jornada_dates" not in cfg

    def test_invite_code_for_fresh_coach(self, api, api_url, fresh_coach):
        headers, _, _, _ = fresh_coach
        r = api.get(f"{api_url}/club/invite", headers=headers)
        assert r.status_code == 200
        code = r.json().get("invite_code")
        assert isinstance(code, str) and len(code) >= 4


class TestParentRegistrationWithInvite:
    def test_register_parent_invalid_code_returns_404(self, api, api_url):
        r = api.post(
            f"{api_url}/auth/register-parent",
            json={
                "email": f"parent_bad_{uuid.uuid4().hex[:6]}@test.com",
                "password": "parent123",
                "nombre": "Padre Bad",
                "invite_code": "INVALIDXXX",
            },
        )
        assert r.status_code == 404

    def test_register_parent_with_valid_invite(self, api, api_url, fresh_coach):
        headers, _, _, _ = fresh_coach
        r = api.get(f"{api_url}/club/invite", headers=headers)
        assert r.status_code == 200
        invite = r.json()["invite_code"]

        parent_email = f"parent_theme_{uuid.uuid4().hex[:8]}@test.com"
        parent_pass = "parent123"
        r = api.post(
            f"{api_url}/auth/register-parent",
            json={
                "email": parent_email,
                "password": parent_pass,
                "nombre": "Padre Theme",
                "invite_code": invite,
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["rol"] == "PADRE"
        parent_headers = {"Authorization": f"Bearer {data['token']}"}

        # auth/me must respond 200
        r = api.get(f"{api_url}/auth/me", headers=parent_headers)
        assert r.status_code == 200
        assert r.json()["user"]["rol"] == "PADRE"

        # Login flow for the new parent must also work
        r = api.post(f"{api_url}/auth/login", json={"email": parent_email, "password": parent_pass})
        assert r.status_code == 200, r.text
        login_token = r.json()["token"]
        r = api.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {login_token}"})
        assert r.status_code == 200

        # Parent is FORBIDDEN from mutating config
        r = api.put(
            f"{api_url}/config",
            json={"theme_preset": "futbase_oro", "custom_colors": None, "dark_mode": True},
            headers=parent_headers,
        )
        assert r.status_code == 403


class TestLoginFlows:
    def test_login_fresh_coach(self, api, api_url, fresh_coach):
        _, _, _, email = fresh_coach
        r = api.post(f"{api_url}/auth/login", json={"email": email, "password": "coach123"})
        assert r.status_code == 200
        token = r.json()["token"]
        r = api.get(f"{api_url}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_login_fixed_coach_regression(self, api, api_url):
        """coach@test.com / test123 must still log in (regression)."""
        r = api.post(f"{api_url}/auth/login", json={"email": "coach@test.com", "password": "test123"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["rol"] == "ENTRENADOR"


class TestConfigUpdate:
    def test_put_config_theme_persists(self, api, api_url, fresh_coach):
        """PUT theme payload returns 200 and persists via subsequent GET."""
        headers, _, _, _ = fresh_coach
        payload = {"theme_preset": "futbase_oro", "custom_colors": None, "dark_mode": True}
        r = api.put(f"{api_url}/config", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["theme_preset"] == "futbase_oro"
        assert body["dark_mode"] is True
        assert body.get("custom_colors") is None

        # GET reflects persisted values
        r = api.get(f"{api_url}/config", headers=headers)
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["theme_preset"] == "futbase_oro"
        assert cfg["dark_mode"] is True
        assert cfg.get("custom_colors") is None

    def test_put_config_can_toggle_theme_fields(self, api, api_url, fresh_coach):
        """Ensure dark_mode False persists too (not stuck on default)."""
        headers, _, _, _ = fresh_coach
        r = api.put(
            f"{api_url}/config",
            json={"theme_preset": "futbase_oro", "custom_colors": None, "dark_mode": False},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["dark_mode"] is False

        r = api.get(f"{api_url}/config", headers=headers)
        assert r.json()["dark_mode"] is False

        # Restore to requested defaults
        r = api.put(
            f"{api_url}/config",
            json={"theme_preset": "futbase_oro", "custom_colors": None, "dark_mode": True},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["dark_mode"] is True
