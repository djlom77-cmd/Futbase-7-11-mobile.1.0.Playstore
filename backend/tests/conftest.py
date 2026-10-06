import os
import io
import time
import uuid
import pytest
import requests

# Use public backend URL (same as mobile client); frontend uses EXPO_PUBLIC_BACKEND_URL
BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or ""
).rstrip("/")

if not BASE_URL:
    # Fallback to frontend/.env parsing
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as fh:
            for line in fh:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                    BASE_URL = line.strip().split("=", 1)[1].strip('"').rstrip("/")
                    break

assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"

API = BASE_URL + "/api"

COACH_EMAIL = "coach@test.com"
COACH_PASS = "test123"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture(scope="session")
def coach_auth(api):
    """Login or register the fixed coach account. Returns (headers, user, token)."""
    # Try login first
    r = api.post(f"{API}/auth/login", json={"email": COACH_EMAIL, "password": COACH_PASS})
    if r.status_code == 200:
        data = r.json()
    else:
        # Register fresh coach
        r = api.post(
            f"{API}/auth/register-coach",
            json={
                "email": COACH_EMAIL,
                "password": COACH_PASS,
                "nombre": "Coach Test",
                "club_name": "Estrella Aljarafe",
            },
        )
        assert r.status_code == 200, f"register-coach failed: {r.status_code} {r.text}"
        data = r.json()
    token = data["token"]
    user = data["user"]
    headers = {"Authorization": f"Bearer {token}"}
    return headers, user, token


@pytest.fixture(scope="session")
def invite_code(api, coach_auth):
    headers, _, _ = coach_auth
    r = api.get(f"{API}/club/invite", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["invite_code"]


@pytest.fixture(scope="session")
def parent_auth(api, invite_code):
    """Create a fresh PADRE for the session."""
    email = f"parent_{uuid.uuid4().hex[:8]}@test.com"
    r = api.post(
        f"{API}/auth/register-parent",
        json={
            "email": email,
            "password": "parent123",
            "nombre": "Padre Test",
            "invite_code": invite_code,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["user"], data["token"]


def _tiny_jpeg_bytes() -> bytes:
    """Build a small valid JPEG using Pillow (available via emergentintegrations stack).
    Falls back to a static minimal JPEG header."""
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (320, 200), "white")
        d = ImageDraw.Draw(img)
        # Draw a simple table of results so Gemini can at least try
        rows = [
            "JORNADA 1",
            "Estrella 3 - 1 Mairena",
            "Tomares 2 - 2 Bormujos",
            "Gines 0 - 1 Coria",
        ]
        y = 10
        for line in rows:
            d.text((10, y), line, fill="black")
            y += 30
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return buf.getvalue()
    except Exception:
        # minimal non-empty JPEG magic header; the AI will likely return nothing
        return bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffd9")


@pytest.fixture(scope="session")
def sample_jpeg():
    return _tiny_jpeg_bytes()
