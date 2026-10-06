import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = "futbase_auth_token";

export async function getToken(): Promise<string | null> {
  return storage.secureGet<string>(TOKEN_KEY, "").then((v) => (v ? v : null));
}
export async function setToken(t: string | null) {
  if (t) await storage.secureSet(TOKEN_KEY, t);
  else await storage.secureRemove(TOKEN_KEY);
}

export const fileUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/api/")) return `${BACKEND_URL}${path}`;
  if (path.startsWith("data:")) return path;
  return `${API}/files/${path}`;
};

export const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const formatDate = (d?: string): string => {
  if (!d) return "";
  try {
    const dt = new Date(`${d}T12:00:00`);
    return `${DAYS[dt.getDay()]}, ${dt.getDate()} de ${MONTHS[dt.getMonth()]}`;
  } catch {
    return d;
  }
};

export const formatApiError = (detail: any): string => {
  if (detail == null) return "Algo salió mal. Inténtalo de nuevo.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && e.msg) || JSON.stringify(e)).join(" ");
  if (detail && detail.msg) return detail.msg;
  return String(detail);
};

type ReqOpts = { method?: string; body?: any; isForm?: boolean };
async function request(path: string, opts: ReqOpts = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!opts.isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.isForm ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(formatApiError(data?.detail) || "Error");
  return data;
}

export const api = {
  get: (p: string) => request(p),
  post: (p: string, body?: any) => request(p, { method: "POST", body }),
  put: (p: string, body?: any) => request(p, { method: "PUT", body }),
  del: (p: string) => request(p, { method: "DELETE" }),
};

// ---- Auth ----
export const authLogin = (email: string, password: string) => api.post("/auth/login", { email, password });
export const registerCoach = (payload: any) => api.post("/auth/register-coach", payload);
export const registerParent = (payload: any) => api.post("/auth/register-parent", payload);
export const fetchMe = () => api.get("/auth/me");
export const forgotPassword = (email: string) => api.post("/auth/forgot-password", { email });
export const resetPassword = (token: string, password: string) => api.post("/auth/reset-password", { token, password });

// ---- Upload / scan from an image-picker asset ----
type PickedAsset = { uri: string; fileName?: string | null; mimeType?: string | null };
function buildForm(asset: PickedAsset): Promise<FormData> {
  const name = asset.fileName || `photo-${Date.now()}.jpg`;
  const type = asset.mimeType || "image/jpeg";
  const form = new FormData();
  if (Platform.OS === "web") {
    return fetch(asset.uri)
      .then((r) => r.blob())
      .then((blob) => {
        form.append("file", blob, name);
        return form;
      });
  }
  form.append("file", { uri: asset.uri, name, type } as any);
  return Promise.resolve(form);
}

export async function uploadImage(asset: PickedAsset) {
  const form = await buildForm(asset);
  return request("/upload", { method: "POST", body: form, isForm: true });
}
export async function scanMatches(asset: PickedAsset) {
  const form = await buildForm(asset);
  return request("/scan/matches", { method: "POST", body: form, isForm: true });
}
export async function scanTeams(asset: PickedAsset) {
  const form = await buildForm(asset);
  return request("/scan/teams", { method: "POST", body: form, isForm: true });
}
