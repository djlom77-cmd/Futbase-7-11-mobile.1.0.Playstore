from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path(__file__).parent / '.env')

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Request, Response, Body, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import base64
import json
import uuid
import hashlib
import secrets
import ipaddress
import re
import requests
import bcrypt
import jwt
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "Liga Alevín"
APP_NAME = "futbase-liga-alevin"
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "tv": token_version, "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    if int(payload.get("tv", 0)) != int(user.get("token_version", 0)):
        raise HTTPException(status_code=401, detail="Sesión caducada, inicia sesión de nuevo")
    return user


async def require_coach(user: dict = Depends(get_current_user)) -> dict:
    if user.get("rol") != "ENTRENADOR":
        raise HTTPException(status_code=403, detail="Solo el entrenador puede realizar esta acción")
    return user


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "nombre": u.get("nombre"), "equipo_id": u.get("equipo_id"), "rol": u.get("rol")}


DEFAULT_CLUB_CONFIG = {
    "club_name": "Mi Equipo",
    "subtitle": "Liga Educa",
    "my_team": "",
    "theme_preset": "futbase_oro",
    "custom_colors": None,
    "dark_mode": True,
    "club_crest_path": None,
    "jornada_dates": {},
}


async def get_club(equipo_id: str) -> dict:
    club = await db.clubs.find_one({"id": equipo_id}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    for k, v in DEFAULT_CLUB_CONFIG.items():
        club.setdefault(k, v)
    return club


# ---------------- Object storage ----------------
storage_key = None
MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}


def init_storage(force=False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path, data, content_type):
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code in (404, 503):
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code in (404, 503):
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------- Models ----------------
class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    equipo_id: Optional[str] = None
    name: str
    venue_name: Optional[str] = ""
    address: Optional[str] = ""
    crest_path: Optional[str] = None


class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    equipo_id: Optional[str] = None
    jornada: int = 1
    home_team: str
    away_team: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: str = "FINALIZADO"


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    equipo_id: Optional[str] = None
    name: str
    nickname: Optional[str] = ""
    dorsal: int = 0
    position: str = "Delantero"
    goals: int = 0
    assists: int = 0
    matches_played: int = 0
    goals_conceded: int = 0
    avatar_url: Optional[str] = None


# ---------------- Email (Emergent managed Resend) ----------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_password_reset_email(to_email: str, token: str) -> bool:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/reset?reset_token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        logger.warning("Email no configurado; enlace de reinicio: %s", link)
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1A1D23">'
            f'<h2 style="margin:0 0 12px">{brand}</h2>'
            f'<p>Recibimos una solicitud para restablecer tu contraseña de {brand}.</p>'
            f'<p><a href="{escape(link)}" style="display:inline-block;padding:12px 20px;background:#1E3A5F;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold">Restablecer contraseña</a></p>'
            f'<p style="font-size:12px;color:#888">Este enlace caduca en 1 hora y se usa una sola vez. '
            f'Enviado por {brand}. Nunca te pediremos tu contraseña por email.</p></td></tr></table>')
    subject = f"Restablece tu contraseña de {EMAIL_FROM_NAME}"
    try:
        _assert_safe_email(subject, html)
        import httpx
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY},
                                json={"to": [to_email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME})
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Reset email failed: {e}")
        return False


# ---------------- Auth endpoints ----------------
@api_router.post("/auth/register-coach")
async def register_coach(payload: dict = Body(...)):
    email = str(payload.get("email", "")).strip().lower()
    password = payload.get("password", "")
    nombre = str(payload.get("nombre", "")).strip()
    club_name = str(payload.get("club_name", "")).strip() or "Mi Equipo"
    if not email or not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Email y contraseña (mín. 6) obligatorios")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Ese email ya está registrado")
    club = dict(DEFAULT_CLUB_CONFIG)
    club.update({"id": str(uuid.uuid4()), "club_name": club_name, "my_team": "",
                 "invite_code": secrets.token_hex(3).upper(), "created_by": email, "created_at": now_iso()})
    await db.clubs.insert_one(dict(club))
    user = {"id": str(uuid.uuid4()), "email": email, "nombre": nombre, "equipo_id": club["id"],
            "rol": "ENTRENADOR", "password_hash": hash_password(password), "token_version": 0, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    token = create_access_token(user["id"], 0)
    return {"token": token, "user": public_user(user)}


@api_router.post("/auth/register-parent")
async def register_parent(payload: dict = Body(...)):
    email = str(payload.get("email", "")).strip().lower()
    password = payload.get("password", "")
    nombre = str(payload.get("nombre", "")).strip()
    invite_code = str(payload.get("invite_code", "")).strip().upper()
    if not email or not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Email y contraseña (mín. 6) obligatorios")
    club = await db.clubs.find_one({"invite_code": invite_code}, {"_id": 0})
    if not club:
        raise HTTPException(status_code=404, detail="Código de equipo no válido")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Ese email ya está registrado")
    user = {"id": str(uuid.uuid4()), "email": email, "nombre": nombre, "equipo_id": club["id"],
            "rol": "PADRE", "password_hash": hash_password(password), "token_version": 0, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    token = create_access_token(user["id"], 0)
    return {"token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(payload: dict = Body(...)):
    email = str(payload.get("email", "")).strip().lower()
    password = payload.get("password", "")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = create_access_token(user["id"], int(user.get("token_version", 0)))
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@api_router.post("/auth/forgot-password")
async def forgot_password(background_tasks: BackgroundTasks, payload: dict = Body(...)):
    email = str(payload.get("email", "")).strip().lower()
    generic = {"message": "Si el email está registrado, se ha enviado un enlace de recuperación."}
    await db.password_reset_requests.insert_one({"email": email, "created_at": datetime.now(timezone.utc)})
    recent = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gt": datetime.now(timezone.utc) - timedelta(minutes=15)}})
    if recent > 5:
        return generic
    user = await db.users.find_one({"email": email})
    if not user:
        return generic
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token_hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user["id"], "email": email,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "used": False})
    background_tasks.add_task(send_password_reset_email, user["email"], token)
    return generic


@api_router.post("/auth/reset-password")
async def reset_password(payload: dict = Body(...)):
    token = payload.get("token", "")
    password = payload.get("password", "")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    h = hashlib.sha256(token.encode()).hexdigest()
    rec = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": datetime.now(timezone.utc)}}, {"$set": {"used": True}})
    if not rec:
        raise HTTPException(status_code=400, detail="Enlace inválido o caducado")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(password)}, "$inc": {"token_version": 1}})
    await db.password_reset_tokens.delete_many({"user_id": rec["user_id"], "used": False})
    return {"ok": True}


# ---------------- Club / Config ----------------
@api_router.get("/config")
async def get_config(user: dict = Depends(get_current_user)):
    club = await get_club(user["equipo_id"])
    club.pop("jornada_dates", None)
    club.pop("invite_code", None)
    return club


@api_router.put("/config")
async def update_config(payload: dict = Body(...), user: dict = Depends(require_coach)):
    allowed = {"club_name", "subtitle", "my_team", "theme_preset", "custom_colors", "dark_mode", "club_crest_path"}
    update = {k: v for k, v in payload.items() if k in allowed}
    await db.clubs.update_one({"id": user["equipo_id"]}, {"$set": update})
    club = await get_club(user["equipo_id"])
    club.pop("jornada_dates", None)
    club.pop("invite_code", None)
    return club


@api_router.get("/club/invite")
async def get_invite(user: dict = Depends(require_coach)):
    club = await get_club(user["equipo_id"])
    return {"invite_code": club.get("invite_code")}


@api_router.post("/club/reset")
async def club_reset(payload: dict = Body(...), user: dict = Depends(require_coach)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(payload.get("password", ""), full.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    eid = user["equipo_id"]
    await db.players.delete_many({"equipo_id": eid})
    await db.teams.delete_many({"equipo_id": eid})
    await db.matches.delete_many({"equipo_id": eid})
    await db.clubs.update_one({"id": eid}, {"$set": dict(DEFAULT_CLUB_CONFIG)})
    return {"ok": True}


# ---------------- Upload / Files ----------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(require_coach)):
    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png")
    content_type = file.content_type or MIME_TYPES.get(ext, "image/png")
    if ext not in MIME_TYPES or not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes (jpg, png, gif, webp)")
    path = f"{APP_NAME}/uploads/{user['equipo_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La imagen supera el límite de 8 MB")
    result = await run_in_threadpool(put_object, path, data, content_type)
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "content_type": content_type, "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api_router.get("/files/{path:path}")
async def download(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = await run_in_threadpool(get_object, path)
    return Response(content=data, media_type=record.get("content_type", content_type))


# ---------------- Teams ----------------
@api_router.get("/teams")
async def list_teams(user: dict = Depends(get_current_user)):
    return await db.teams.find({"equipo_id": user["equipo_id"]}, {"_id": 0}).to_list(500)


@api_router.post("/teams")
async def create_team(team: Team, user: dict = Depends(require_coach)):
    eid = user["equipo_id"]
    existing = await db.teams.find_one({"equipo_id": eid, "name": team.name}, {"_id": 0})
    if existing:
        data = team.model_dump()
        data["id"] = existing["id"]
        data["equipo_id"] = eid
        await db.teams.update_one({"id": existing["id"]}, {"$set": data})
        return data
    data = team.model_dump()
    data["equipo_id"] = eid
    await db.teams.insert_one(dict(data))
    return data


@api_router.put("/teams/{team_id}")
async def update_team(team_id: str, payload: dict = Body(...), user: dict = Depends(require_coach)):
    allowed = {"name", "venue_name", "address", "crest_path"}
    update = {k: v for k, v in payload.items() if k in allowed}
    await db.teams.update_one({"id": team_id, "equipo_id": user["equipo_id"]}, {"$set": update})
    return await db.teams.find_one({"id": team_id, "equipo_id": user["equipo_id"]}, {"_id": 0})


@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user: dict = Depends(require_coach)):
    await db.teams.delete_one({"id": team_id, "equipo_id": user["equipo_id"]})
    return {"ok": True}


async def ensure_team(name, eid):
    name = name.strip()
    if name and not await db.teams.find_one({"equipo_id": eid, "name": name}):
        await db.teams.insert_one(Team(name=name, equipo_id=eid).model_dump())


# ---------------- Matches ----------------
@api_router.get("/matches")
async def list_matches(jornada: Optional[int] = None, user: dict = Depends(get_current_user)):
    q = {"equipo_id": user["equipo_id"]}
    if jornada is not None:
        q["jornada"] = jornada
    matches = await db.matches.find(q, {"_id": 0}).to_list(1000)
    matches.sort(key=lambda m: m.get("jornada", 0))
    return matches


@api_router.get("/jornadas")
async def list_jornadas(user: dict = Depends(get_current_user)):
    return sorted(await db.matches.distinct("jornada", {"equipo_id": user["equipo_id"]}))


@api_router.get("/jornada-dates")
async def get_jornada_dates(user: dict = Depends(get_current_user)):
    club = await get_club(user["equipo_id"])
    return club.get("jornada_dates", {})


@api_router.put("/jornada-dates")
async def set_jornada_date(payload: dict = Body(...), user: dict = Depends(require_coach)):
    club = await get_club(user["equipo_id"])
    dates = club.get("jornada_dates", {})
    j = str(payload.get("jornada"))
    date = payload.get("date", "")
    if date:
        dates[j] = date
    else:
        dates.pop(j, None)
    await db.clubs.update_one({"id": user["equipo_id"]}, {"$set": {"jornada_dates": dates}})
    return dates


@api_router.post("/matches")
async def create_match(match: Match, user: dict = Depends(require_coach)):
    eid = user["equipo_id"]
    await ensure_team(match.home_team, eid)
    await ensure_team(match.away_team, eid)
    data = match.model_dump()
    data["equipo_id"] = eid
    await db.matches.insert_one(dict(data))
    return data


@api_router.put("/matches/{match_id}")
async def update_match(match_id: str, payload: dict = Body(...), user: dict = Depends(require_coach)):
    allowed = {"jornada", "home_team", "away_team", "home_score", "away_score", "status"}
    update = {k: v for k, v in payload.items() if k in allowed}
    await db.matches.update_one({"id": match_id, "equipo_id": user["equipo_id"]}, {"$set": update})
    return await db.matches.find_one({"id": match_id, "equipo_id": user["equipo_id"]}, {"_id": 0})


@api_router.delete("/matches/{match_id}")
async def delete_match(match_id: str, user: dict = Depends(require_coach)):
    await db.matches.delete_one({"id": match_id, "equipo_id": user["equipo_id"]})
    return {"ok": True}


@api_router.post("/matches/bulk")
async def bulk_matches(payload: dict = Body(...), user: dict = Depends(require_coach)):
    eid = user["equipo_id"]
    jornada = int(payload.get("jornada", 1))
    created = []
    for it in payload.get("matches", []):
        ht, at = str(it.get("home_team", "")).strip(), str(it.get("away_team", "")).strip()
        if not ht or not at:
            continue
        m = Match(jornada=jornada, home_team=ht, away_team=at, home_score=it.get("home_score"), away_score=it.get("away_score"), status=it.get("status", "FINALIZADO"), equipo_id=eid)
        await ensure_team(ht, eid)
        await ensure_team(at, eid)
        await db.matches.insert_one(m.model_dump())
        created.append(m.model_dump())
    return {"created": len(created), "matches": created}


@api_router.get("/standings")
async def standings(user: dict = Depends(get_current_user)):
    eid = user["equipo_id"]
    matches = await db.matches.find({"equipo_id": eid}, {"_id": 0}).to_list(2000)
    teams = await db.teams.find({"equipo_id": eid}, {"_id": 0}).to_list(500)
    table = {}

    def row(name):
        if name not in table:
            table[name] = {"team": name, "pj": 0, "pg": 0, "pe": 0, "pp": 0, "gf": 0, "gc": 0, "dg": 0, "pts": 0}
        return table[name]

    for t in teams:
        row(t["name"])
    for m in matches:
        if m.get("home_score") is None or m.get("away_score") is None:
            continue
        h, a = row(m["home_team"]), row(m["away_team"])
        hs, as_ = int(m["home_score"]), int(m["away_score"])
        h["pj"] += 1; a["pj"] += 1; h["gf"] += hs; h["gc"] += as_; a["gf"] += as_; a["gc"] += hs
        if hs > as_:
            h["pg"] += 1; h["pts"] += 3; a["pp"] += 1
        elif hs < as_:
            a["pg"] += 1; a["pts"] += 3; h["pp"] += 1
        else:
            h["pe"] += 1; a["pe"] += 1; h["pts"] += 1; a["pts"] += 1
    for r in table.values():
        r["dg"] = r["gf"] - r["gc"]
    rows = sorted(table.values(), key=lambda r: (-r["pts"], -r["dg"], -r["gf"], r["team"]))
    meta = {t["name"]: t for t in teams}
    for i, r in enumerate(rows):
        r["position"] = i + 1
        m = meta.get(r["team"], {})
        r["venue_name"] = m.get("venue_name", ""); r["address"] = m.get("address", ""); r["crest_path"] = m.get("crest_path")
    return rows


# ---------------- Players ----------------
@api_router.get("/players")
async def list_players(user: dict = Depends(get_current_user)):
    players = await db.players.find({"equipo_id": user["equipo_id"]}, {"_id": 0}).to_list(500)
    players.sort(key=lambda p: p.get("dorsal", 0))
    return players


@api_router.post("/players")
async def create_player(player: Player, user: dict = Depends(require_coach)):
    data = player.model_dump()
    data["equipo_id"] = user["equipo_id"]
    await db.players.insert_one(dict(data))
    return data


@api_router.put("/players/{player_id}")
async def update_player(player_id: str, payload: dict = Body(...), user: dict = Depends(require_coach)):
    allowed = {"name", "nickname", "dorsal", "position", "goals", "assists", "matches_played", "goals_conceded", "avatar_url"}
    update = {k: v for k, v in payload.items() if k in allowed}
    await db.players.update_one({"id": player_id, "equipo_id": user["equipo_id"]}, {"$set": update})
    return await db.players.find_one({"id": player_id, "equipo_id": user["equipo_id"]}, {"_id": 0})


@api_router.post("/players/{player_id}/stats")
async def add_stats(player_id: str, payload: dict = Body(...), user: dict = Depends(require_coach)):
    inc = {k: int(payload[k]) for k in ("goals", "assists", "matches_played", "goals_conceded") if k in payload}
    if inc:
        await db.players.update_one({"id": player_id, "equipo_id": user["equipo_id"]}, {"$inc": inc})
    return await db.players.find_one({"id": player_id, "equipo_id": user["equipo_id"]}, {"_id": 0})


@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str, user: dict = Depends(require_coach)):
    await db.players.delete_one({"id": player_id, "equipo_id": user["equipo_id"]})
    return {"ok": True}


# ---------------- AI Vision Scan ----------------
def _parse_llm_json(response):
    text = response.strip() if isinstance(response, str) else str(response)
    if "```" in text:
        for p in text.split("```"):
            if "{" in p:
                text = p
                break
        if text.strip().startswith("json"):
            text = text.strip()[4:]
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        s, e = text.find("{"), text.rfind("}")
        if s != -1 and e != -1:
            return json.loads(text[s:e + 1])
        raise HTTPException(status_code=502, detail="No se pudo interpretar la respuesta de la IA")


async def _gemini_vision(b64, prompt, system):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"scan-{uuid.uuid4()}", system_message=system).with_model("gemini", "gemini-3.1-pro-preview")
    try:
        return await chat.send_message(UserMessage(text=prompt, file_contents=[ImageContent(image_base64=b64)]))
    except Exception as e:
        logger.error(f"AI scan failed: {e}")
        raise HTTPException(status_code=502, detail=f"Error al procesar la imagen con IA: {e}")


@api_router.post("/scan/matches")
async def scan_matches(file: UploadFile = File(...), user: dict = Depends(require_coach)):
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La imagen supera el límite de 10 MB")
    b64 = base64.b64encode(raw).decode("utf-8")
    prompt = ("Eres un asistente que lee tablas de resultados de fútbol. Extrae TODOS los partidos: equipo local, visitante y marcador. "
              "Si un marcador no es visible, usa null. Devuelve SOLO JSON: "
              '{"matches":[{"home_team":"string","away_team":"string","home_score":number|null,"away_score":number|null}]}.')
    parsed = _parse_llm_json(await _gemini_vision(b64, prompt, "Extraes datos de imágenes deportivas y respondes solo con JSON."))
    clean = [{"home_team": str(m.get("home_team")).strip(), "away_team": str(m.get("away_team")).strip(), "home_score": m.get("home_score"), "away_score": m.get("away_score")}
             for m in (parsed.get("matches", []) if isinstance(parsed, dict) else []) if m.get("home_team") and m.get("away_team")]
    return {"matches": clean}


@api_router.post("/scan/teams")
async def scan_teams(file: UploadFile = File(...), user: dict = Depends(require_coach)):
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="La imagen supera el límite de 10 MB")
    b64 = base64.b64encode(raw).decode("utf-8")
    prompt = ("Analiza la imagen (lista de equipos, calendario o campos con direcciones). Extrae cada equipo con su campo y dirección si aparecen. "
              "Si no hay, usa cadena vacía. Devuelve SOLO JSON: {\"teams\":[{\"name\":\"string\",\"venue_name\":\"string\",\"address\":\"string\"}]}.")
    parsed = _parse_llm_json(await _gemini_vision(b64, prompt, "Extraes equipos y direcciones y respondes solo con JSON."))
    clean = [{"name": str(t.get("name")).strip(), "venue_name": str(t.get("venue_name") or "").strip(), "address": str(t.get("address") or "").strip()}
             for t in (parsed.get("teams", []) if isinstance(parsed, dict) else []) if t.get("name")]
    return {"teams": clean}


# ---------------- Seed (coach demo) ----------------
@api_router.post("/seed")
async def seed(user: dict = Depends(require_coach)):
    eid = user["equipo_id"]
    await db.players.delete_many({"equipo_id": eid})
    await db.teams.delete_many({"equipo_id": eid})
    await db.matches.delete_many({"equipo_id": eid})
    venues = [
        ("Estrella Aljarafe", "C.D. Los Olivos Aljarafe", "Calle Deportes s/n, 41920 San Juan de Aznalfarache, Sevilla"),
        ("CD Mairena del Aljarafe", "Complejo Deportivo Cavaleri", "Av. de la Filosofía s/n, 41927 Mairena del Aljarafe, Sevilla"),
        ("AD Tomares Alevín", "Estadio Municipal San Sebastián", "Calle San Sebastián 12, 41940 Tomares, Sevilla"),
        ("CD Bormujos Balompié", "Polideportivo Municipal Pepe Flores", "Av. Almensilla s/n, 41930 Bormujos, Sevilla"),
        ("Gines Atlético", "Estadio Nuevo San José Gines", "Calle Virgen del Rocío s/n, 41960 Gines, Sevilla"),
        ("Coria CF Alevín", "Estadio Guadalquivir", "Paseo Marítimo s/n, 41100 Coria del Río, Sevilla"),
        ("Castilleja CF Promesas", "Estadio Municipal Antonio Almendro", "Calle Real 140, 41950 Castilleja de la Cuesta, Sevilla"),
        ("Espartinas CF", "Polideportivo Municipal Espartaco", "Carretera Sevilla-Huelva, 41807 Espartinas, Sevilla"),
    ]
    for name, vn, addr in venues:
        await db.teams.insert_one(Team(name=name, venue_name=vn, address=addr, equipo_id=eid).model_dump())
    squad = [
        ("Hugo Morales", "Hugol", 9, "Delantero", 14, 6, 8), ("Mateo Romero", "El Mago", 10, "Centrocampista", 8, 11, 8),
        ("Leo Castillo", "El Muro", 1, "Portero", 0, 1, 8), ("Daniel Santos", "Dani", 4, "Defensa", 2, 3, 8),
        ("Pablo Gómez", "Pablito", 7, "Delantero", 9, 7, 8), ("Adrián Navarro", "Adri", 6, "Centrocampista", 3, 5, 8),
        ("Alejandro Pérez", "Álex", 3, "Defensa", 1, 4, 7), ("Iker Martín", "El Galgo", 11, "Delantero", 6, 8, 8),
    ]
    for name, nick, dorsal, pos, g, a, mp in squad:
        await db.players.insert_one(Player(name=name, nickname=nick, dorsal=dorsal, position=pos, goals=g, assists=a, matches_played=mp, equipo_id=eid).model_dump())
    results = [(1, "Estrella Aljarafe", "CD Mairena del Aljarafe", 3, 1), (1, "AD Tomares Alevín", "CD Bormujos Balompié", 2, 2),
               (1, "Gines Atlético", "Coria CF Alevín", 0, 1), (1, "Castilleja CF Promesas", "Espartinas CF", 4, 0),
               (2, "CD Bormujos Balompié", "Estrella Aljarafe", 0, 2), (2, "Coria CF Alevín", "Castilleja CF Promesas", 3, 3),
               (3, "Estrella Aljarafe", "AD Tomares Alevín", 5, 2), (3, "Gines Atlético", "CD Bormujos Balompié", 1, 0)]
    for j, h, a, hs, as_ in results:
        await db.matches.insert_one(Match(jornada=j, home_team=h, away_team=a, home_score=hs, away_score=as_, equipo_id=eid).model_dump())
    for j, h, a in [(4, "Gines Atlético", "Estrella Aljarafe"), (4, "CD Mairena del Aljarafe", "Coria CF Alevín")]:
        await db.matches.insert_one(Match(jornada=j, home_team=h, away_team=a, status="PRÓXIMO", equipo_id=eid).model_dump())
    await db.clubs.update_one({"id": eid}, {"$set": {"my_team": "Estrella Aljarafe", "jornada_dates": {"1": "2026-09-13", "2": "2026-09-20", "3": "2026-09-27", "4": "2026-10-04"}}})
    return {"ok": True}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or len(secret) < 32 or "change_me" in secret.lower():
        logger.error("JWT_SECRET is weak or a placeholder. Set a unique high-entropy secret before production.")
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
