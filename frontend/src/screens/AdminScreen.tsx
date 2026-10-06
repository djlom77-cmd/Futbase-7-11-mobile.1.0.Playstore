import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import {
  AlertTriangle,
  Camera,
  ClipboardList,
  Image as ImageIcon,
  MapPin,
  Moon,
  Palette,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";

import { api, fileUrl, scanMatches as apiScanMatches, scanTeams as apiScanTeams, uploadImage } from "@/src/api";
import { DefaultCrest, TeamCrest } from "@/src/components/Crest";
import { useToast } from "@/src/context/toast";
import { openSettings, pickFromCamera, pickFromGallery } from "@/src/utils/pickImage";
import { AppColors, buildCustomTheme, THEME_PRESETS, useAppColors, useAppThemedStyles } from "@/src/theme";

const POSITIONS = ["Portero", "Defensa", "Centrocampista", "Delantero"];

export default function AdminScreen({ config, players, teams, matches, jornadaDates, reload, onLogout }: any) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  const toast = useToast();

  const seed = async () => {
    try {
      await api.post("/seed");
      toast.success("Datos de ejemplo cargados");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={s.title}>Panel del Entrenador</Text>
        </View>
        <Pressable testID="logout-btn" onPress={onLogout} style={[s.logoutBtn, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <ClubManager config={config} teams={teams} reload={reload} />
      <InviteManager />
      <ResultsManager reload={reload} jornadaDates={jornadaDates} />
      <MatchesManager matches={matches} reload={reload} jornadaDates={jornadaDates} />
      <TeamsManager teams={teams} reload={reload} />
      <PlayerManager players={players} reload={reload} />
      <CrestManager config={config} reload={reload} />
      <ThemeManager config={config} reload={reload} />

      <Pressable testID="seed-btn" onPress={seed} style={[s.outlineBtn, { borderColor: colors.border }]}>
        <Sparkles size={15} color={colors.muted} />
        <Text style={{ fontWeight: "700", fontSize: 13.5, color: colors.muted }}>Cargar datos de ejemplo (demo)</Text>
      </Pressable>

      <ResetManager reload={reload} />
    </ScrollView>
  );
}

function Section({ icon: Icon, title, children }: any) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Icon size={18} color={colors.primary} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const colors = useAppColors();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[{ paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, color: colors.text, fontSize: 14 }, props.style]}
    />
  );
}

function FillBtn({ onPress, label, icon: Icon, color, loading, testID }: any) {
  const colors = useAppColors();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={loading} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: color || colors.primary }, pressed && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : Icon ? <Icon size={16} color="#fff" /> : null}
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

function PhotoSource({ onAsset, scanning, labelCamera = "Cámara", labelGallery = "Galería" }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const go = async (which: "camera" | "gallery") => {
    const res = which === "camera" ? await pickFromCamera() : await pickFromGallery();
    if (res.status === "denied") {
      toast.error("Permiso denegado. Actívalo en Ajustes.");
      openSettings();
      return;
    }
    if (res.status === "ok" && res.asset) onAsset(res.asset);
  };
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}>
        <FillBtn testID="ai-scan-btn" onPress={() => go("camera")} loading={scanning} icon={Camera} label={scanning ? "Analizando..." : labelCamera} color={colors.primary} />
      </View>
      <Pressable testID="ai-gallery-btn" onPress={() => go("gallery")} disabled={scanning} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary }}>
        <ImageIcon size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13.5 }}>{labelGallery}</Text>
      </Pressable>
    </View>
  );
}

function ClubManager({ config, teams, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [name, setName] = useState(config.club_name || "");
  const [subtitle, setSubtitle] = useState(config.subtitle || "");
  const [myTeam, setMyTeam] = useState(config.my_team || "");
  useEffect(() => {
    setName(config.club_name || "");
    setSubtitle(config.subtitle || "");
    setMyTeam(config.my_team || "");
  }, [config]);
  const save = async () => {
    if (!name.trim()) return toast.error("Escribe el nombre del club");
    try {
      await api.put("/config", { club_name: name.trim(), subtitle: subtitle.trim(), my_team: myTeam.trim() });
      toast.success("Club actualizado");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };
  return (
    <Section icon={ShieldCheck} title="Mi Club">
      <Input testID="club-name-input" value={name} onChangeText={setName} placeholder="Nombre del club (cabecera)" />
      <Input testID="club-subtitle-input" value={subtitle} onChangeText={setSubtitle} placeholder="Subtítulo (p. ej. Liga Educa)" style={{ marginTop: 10 }} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 10, marginBottom: 6 }}>Mi equipo en la liga (se resalta en la tabla y el próximo partido)</Text>
      <Input testID="my-team-input" value={myTeam} onChangeText={setMyTeam} placeholder="Nombre de mi equipo" />
      <View style={{ marginTop: 12 }}>
        <FillBtn testID="save-club-btn" onPress={save} icon={Save} label="Guardar club" />
      </View>
    </Section>
  );
}

function InviteManager() {
  const colors = useAppColors();
  const toast = useToast();
  const [code, setCode] = useState("");
  useEffect(() => {
    api.get("/club/invite").then((r) => setCode(r.invite_code)).catch(() => {});
  }, []);
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    toast.success("Código copiado");
  };
  return (
    <Section icon={UserPlus} title="Invitar Padres/Madres">
      <Text style={{ fontSize: 12.5, color: colors.muted }}>Comparte este código para que los padres se unan en modo solo lectura.</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
        <View testID="invite-code" style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: colors.bg }}>
          <Text style={{ fontWeight: "900", fontSize: 22, letterSpacing: 3, color: colors.primary }}>{code || "—"}</Text>
        </View>
        <Pressable testID="share-invite-btn" onPress={copy} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13.5 }}>Copiar</Text>
        </Pressable>
      </View>
    </Section>
  );
}

function ResultsManager({ reload, jornadaDates }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [jornada, setJornada] = useState("1");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  useEffect(() => setDate(jornadaDates[jornada] || ""), [jornada, jornadaDates]);

  const onAsset = async (asset: any) => {
    setScanning(true);
    try {
      const data = await apiScanMatches(asset);
      if (!data.matches?.length) toast.error("La IA no detectó partidos. Prueba otra foto o usa el formulario manual.");
      else {
        setRows(data.matches.map((m: any) => ({ _k: `${Date.now()}-${Math.random()}`, ...m })));
        toast.success(`${data.matches.length} partidos detectados. Revísalos antes de guardar.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al escanear la imagen");
    } finally {
      setScanning(false);
    }
  };
  const addRow = () => setRows([...rows, { _k: `${Date.now()}`, home_team: "", away_team: "", home_score: "", away_score: "" }]);
  const upd = (i: number, k: string, v: string) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const rm = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const save = async () => {
    const valid = rows.filter((r) => r.home_team?.trim() && r.away_team?.trim());
    if (!valid.length) return toast.error("Añade al menos un partido válido");
    try {
      await api.post("/matches/bulk", {
        jornada: Number(jornada),
        matches: valid.map((r) => ({
          home_team: r.home_team.trim(),
          away_team: r.away_team.trim(),
          home_score: r.home_score === "" || r.home_score == null ? null : Number(r.home_score),
          away_score: r.away_score === "" || r.away_score == null ? null : Number(r.away_score),
        })),
      });
      if (date) await api.put("/jornada-dates", { jornada: Number(jornada), date });
      toast.success("Resultados guardados y clasificación recalculada");
      setRows([]);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron guardar los resultados");
    }
  };
  return (
    <Section icon={Camera} title="Resultados de la Jornada">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>Jornada</Text>
        <Input value={String(jornada)} onChangeText={setJornada} keyboardType="number-pad" style={{ width: 56, textAlign: "center" }} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>Fecha</Text>
        <Input testID="jornada-date-input" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{ flex: 1, minWidth: 120 }} />
      </View>
      <PhotoSource onAsset={onAsset} scanning={scanning} />
      <Text style={{ fontSize: 11, textAlign: "center", color: colors.muted, marginVertical: 8 }}>Escanea con IA la tabla de resultados (cámara o galería)</Text>
      <Divider label="o manual" />
      <View style={{ gap: 8 }}>
        {rows.map((r, i) => (
          <View key={r._k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Input value={r.home_team} onChangeText={(v) => upd(i, "home_team", v)} placeholder="Local" style={{ flex: 1, fontSize: 12.5 }} />
            <Input value={String(r.home_score ?? "")} onChangeText={(v) => upd(i, "home_score", v)} keyboardType="number-pad" style={{ width: 38, textAlign: "center" }} />
            <Text style={{ color: colors.muted }}>-</Text>
            <Input value={String(r.away_score ?? "")} onChangeText={(v) => upd(i, "away_score", v)} keyboardType="number-pad" style={{ width: 38, textAlign: "center" }} />
            <Input value={r.away_team} onChangeText={(v) => upd(i, "away_team", v)} placeholder="Visitante" style={{ flex: 1, fontSize: 12.5 }} />
            <Pressable onPress={() => rm(i)}><Trash2 size={16} color={colors.danger} /></Pressable>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Pressable onPress={addRow} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
          <Plus size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Añadir partido</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <FillBtn testID="save-results-btn" onPress={save} icon={Save} label="Guardar" color={colors.accent} />
        </View>
      </View>
    </Section>
  );
}

function Divider({ label }: { label: string }) {
  const colors = useAppColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

function MatchesManager({ matches, reload, jornadaDates }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const jornadas = [...new Set(matches.map((m: any) => m.jornada))].sort((a: number, b: number) => a - b) as number[];
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [dateEdits, setDateEdits] = useState<Record<string, string>>({});

  const saveDate = async (j: number) => {
    await api.put("/jornada-dates", { jornada: Number(j), date: dateEdits[j] ?? jornadaDates[j] ?? "" });
    toast.success("Fecha de jornada actualizada");
    reload();
  };
  const remove = async (id: string) => {
    await api.del(`/matches/${id}`);
    toast.success("Partido eliminado y clasificación recalculada");
    reload();
  };
  const setScore = (id: string, k: string, v: string) => setEdits((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const saveScore = async (m: any) => {
    const e = edits[m.id] || {};
    const hs = e.home_score ?? m.home_score;
    const as_ = e.away_score ?? m.away_score;
    await api.put(`/matches/${m.id}`, {
      home_score: hs === "" || hs == null ? null : Number(hs),
      away_score: as_ === "" || as_ == null ? null : Number(as_),
    });
    toast.success("Marcador actualizado y clasificación recalculada");
    reload();
  };
  return (
    <Section icon={ClipboardList} title="Editar / Borrar Partidos">
      {matches.length === 0 ? (
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.muted }}>No hay partidos guardados.</Text>
      ) : (
        <View style={{ gap: 14 }}>
          {jornadas.map((j) => (
            <View key={j}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", color: colors.muted }}>Jornada {j}</Text>
                <Input defaultValue={jornadaDates[j] || ""} onChangeText={(v) => setDateEdits((p) => ({ ...p, [j]: v }))} placeholder="YYYY-MM-DD" style={{ flex: 1, paddingVertical: 5, fontSize: 11.5 }} />
                <Pressable testID="save-jornada-date-btn" onPress={() => saveDate(j)}><Save size={15} color={colors.primary} /></Pressable>
              </View>
              <View style={{ gap: 6 }}>
                {matches.filter((m: any) => m.jornada === j).map((m: any) => (
                  <View key={m.id} testID="admin-match-row" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.bg }}>
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: "600", textAlign: "right", color: colors.text }} numberOfLines={1}>{m.home_team}</Text>
                    <Input defaultValue={m.home_score == null ? "" : String(m.home_score)} onChangeText={(v) => setScore(m.id, "home_score", v)} keyboardType="number-pad" style={{ width: 34, textAlign: "center", paddingVertical: 5 }} />
                    <Text style={{ color: colors.muted }}>-</Text>
                    <Input defaultValue={m.away_score == null ? "" : String(m.away_score)} onChangeText={(v) => setScore(m.id, "away_score", v)} keyboardType="number-pad" style={{ width: 34, textAlign: "center", paddingVertical: 5 }} />
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: "600", color: colors.text }} numberOfLines={1}>{m.away_team}</Text>
                    <Pressable testID="save-match-btn" onPress={() => saveScore(m)}><Save size={15} color={colors.primary} /></Pressable>
                    <Pressable testID="delete-match-btn" onPress={() => remove(m.id)}><Trash2 size={15} color={colors.danger} /></Pressable>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function TeamsManager({ teams, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState({ name: "", venue_name: "", address: "" });

  const onAsset = async (asset: any) => {
    setScanning(true);
    try {
      const data = await apiScanTeams(asset);
      if (!data.teams?.length) toast.error("La IA no detectó equipos ni campos. Prueba otra foto o añádelos manualmente.");
      else {
        for (const t of data.teams) await api.post("/teams", { name: t.name, venue_name: t.venue_name || "", address: t.address || "" });
        toast.success(`${data.teams.length} equipos/campos añadidos`);
        reload();
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al escanear la imagen");
    } finally {
      setScanning(false);
    }
  };
  const addTeam = async () => {
    if (!form.name.trim()) return toast.error("Escribe el nombre del equipo");
    await api.post("/teams", { name: form.name.trim(), venue_name: form.venue_name.trim(), address: form.address.trim() });
    toast.success("Equipo guardado");
    setForm({ name: "", venue_name: "", address: "" });
    reload();
  };
  return (
    <Section icon={MapPin} title="Equipos y Campos (Direcciones)">
      <PhotoSource onAsset={onAsset} scanning={scanning} />
      <Text style={{ fontSize: 11, textAlign: "center", color: colors.muted, marginVertical: 8 }}>Escanea con IA equipos y campos (cámara o galería)</Text>
      <Divider label="o manual" />
      <View style={{ gap: 8 }}>
        <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nombre del equipo" />
        <Input value={form.venue_name} onChangeText={(v) => setForm({ ...form, venue_name: v })} placeholder="Nombre del campo / instalación" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Dirección (Google Maps)" style={{ flex: 1 }} />
          <Pressable testID="add-team-btn" onPress={addTeam} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accent, justifyContent: "center" }}>
            <Plus size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Añadir</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ gap: 10, marginTop: 12 }}>
        {teams.map((t: any) => (
          <AdminTeamRow key={t.id} t={t} reload={reload} />
        ))}
      </View>
    </Section>
  );
}

function AdminTeamRow({ t, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [venue, setVenue] = useState(t.venue_name || "");
  const [address, setAddress] = useState(t.address || "");
  const [uploading, setUploading] = useState(false);
  const uploadCrest = async () => {
    const res = await pickFromGallery();
    if (res.status === "denied") { toast.error("Permiso denegado. Actívalo en Ajustes."); openSettings(); return; }
    if (res.status !== "ok" || !res.asset) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(res.asset);
      await api.put(`/teams/${t.id}`, { crest_path: url });
      toast.success(`Escudo de ${t.name} actualizado`);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Error al subir el escudo");
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    await api.put(`/teams/${t.id}`, { venue_name: venue, address });
    toast.success("Campo y dirección actualizados");
    reload();
  };
  const remove = async () => { await api.del(`/teams/${t.id}`); toast.success("Equipo eliminado"); reload(); };
  return (
    <View testID="admin-team-row" style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TeamCrest name={t.name} crest={t.crest_path} size={34} primary={colors.primary} primaryLight={colors.primaryLight} />
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.text }} numberOfLines={1}>{t.name}</Text>
        <Pressable testID="team-crest-upload-btn" onPress={uploadCrest} disabled={uploading} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
          {uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <ImageIcon size={12} color={colors.primary} />}
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>Escudo</Text>
        </Pressable>
        <Pressable onPress={remove}><Trash2 size={14} color={colors.danger} /></Pressable>
      </View>
      <Input value={venue} onChangeText={setVenue} placeholder="Nombre del campo" style={{ fontSize: 12.5, paddingVertical: 8 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Input value={address} onChangeText={setAddress} placeholder="Dirección del campo" style={{ flex: 1, fontSize: 12.5, paddingVertical: 8 }} />
        <Pressable testID="save-team-btn" onPress={save} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primary, justifyContent: "center" }}>
          <Save size={12} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Guardar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PositionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colors = useAppColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {POSITIONS.map((p) => {
        const active = p === value;
        return (
          <Pressable key={p} onPress={() => onChange(p)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, flexShrink: 0, backgroundColor: active ? colors.primary : colors.bg, borderColor: active ? colors.primary : colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : colors.muted }}>{p}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PlayerManager({ players, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [form, setForm] = useState<any>({ name: "", nickname: "", dorsal: "", position: "Delantero", avatar_url: null });
  const [saving, setSaving] = useState(false);

  const uploadAvatar = async () => {
    const res = await pickFromGallery();
    if (res.status === "denied") { toast.error("Permiso denegado. Actívalo en Ajustes."); openSettings(); return; }
    if (res.status !== "ok" || !res.asset) return;
    try {
      const { url } = await uploadImage(res.asset);
      setForm((f: any) => ({ ...f, avatar_url: url }));
      toast.success("Foto lista");
    } catch (e: any) {
      toast.error(e?.message || "Error al subir la foto");
    }
  };
  const add = async () => {
    if (!form.name.trim()) return toast.error("Escribe el nombre del jugador");
    setSaving(true);
    try {
      await api.post("/players", { name: form.name.trim(), nickname: form.nickname.trim(), dorsal: Number(form.dorsal) || 0, position: form.position, avatar_url: form.avatar_url });
      toast.success("Jugador añadido");
      setForm({ name: "", nickname: "", dorsal: "", position: "Delantero", avatar_url: null });
      reload();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section icon={UsersIcon} title="Plantilla y Estadísticas">
      <View style={{ gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nombre" style={{ flex: 1 }} />
          <Input value={String(form.dorsal)} onChangeText={(v) => setForm({ ...form, dorsal: v })} placeholder="Dorsal" keyboardType="number-pad" style={{ width: 64, textAlign: "center" }} />
        </View>
        <Input value={form.nickname} onChangeText={(v) => setForm({ ...form, nickname: v })} placeholder="Apodo" />
        <PositionPicker value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={uploadAvatar} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Camera size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{form.avatar_url ? "Foto lista ✓" : "Foto"}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <FillBtn testID="add-player-btn" onPress={add} loading={saving} icon={Plus} label="Añadir jugador" color={colors.accent} />
          </View>
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 10 }}>
        {players.map((p: any) => (
          <PlayerRow key={p.id} p={p} reload={reload} />
        ))}
      </View>
    </Section>
  );
}

function Stepper({ label, value, field, color, id, reload, testID }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const change = async (delta: number) => {
    try { await api.post(`/players/${id}/stats`, { [field]: delta }); reload(); } catch { toast.error("Error"); }
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", textTransform: "uppercase", color: colors.muted, width: 34, textAlign: "right" }}>{label}</Text>
      <Pressable onPress={() => change(-1)} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted, fontWeight: "800" }}>−</Text>
      </Pressable>
      <Text style={{ width: 22, textAlign: "center", fontSize: 13.5, fontWeight: "800", color: colors.text }}>{value}</Text>
      <Pressable testID={testID} onPress={() => change(1)} style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>+</Text>
      </Pressable>
    </View>
  );
}

function PlayerRow({ p, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({ name: p.name, nickname: p.nickname || "", dorsal: String(p.dorsal), position: p.position, avatar_url: p.avatar_url });
  const isGK = p.position === "Portero";

  const uploadAvatar = async () => {
    const res = await pickFromGallery();
    if (res.status === "denied") { toast.error("Permiso denegado. Actívalo en Ajustes."); openSettings(); return; }
    if (res.status !== "ok" || !res.asset) return;
    try { const { url } = await uploadImage(res.asset); setForm((f: any) => ({ ...f, avatar_url: url })); toast.success("Foto lista"); }
    catch (e: any) { toast.error(e?.message || "Error al subir la foto"); }
  };
  const save = async () => {
    if (!form.name.trim()) return toast.error("El nombre no puede estar vacío");
    await api.put(`/players/${p.id}`, { name: form.name.trim(), nickname: form.nickname.trim(), dorsal: Number(form.dorsal) || 0, position: form.position, avatar_url: form.avatar_url });
    toast.success("Jugador actualizado");
    setEditing(false);
    reload();
  };
  const remove = async () => { await api.del(`/players/${p.id}`); toast.success("Jugador eliminado"); reload(); };

  if (editing) {
    return (
      <View testID="player-edit-row" style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nombre" style={{ flex: 1 }} />
          <Input value={String(form.dorsal)} onChangeText={(v) => setForm({ ...form, dorsal: v })} keyboardType="number-pad" style={{ width: 60, textAlign: "center" }} />
        </View>
        <Input value={form.nickname} onChangeText={(v) => setForm({ ...form, nickname: v })} placeholder="Apodo" />
        <PositionPicker value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={uploadAvatar} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Camera size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12.5 }}>{form.avatar_url ? "Foto lista ✓" : "Cambiar foto"}</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)} style={{ paddingHorizontal: 14, justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12.5 }}>Cancelar</Text>
          </Pressable>
          <Pressable testID="save-player-edit-btn" onPress={save} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, justifyContent: "center", borderRadius: 12, backgroundColor: colors.accent }}>
            <Save size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12.5 }}>Guardar</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ width: 24, textAlign: "center", fontWeight: "800", fontSize: 13.5, color: colors.primary }}>{p.dorsal}</Text>
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.text }} numberOfLines={1}>{p.name}</Text>
        <Pressable testID="edit-player-btn" onPress={() => { setForm({ name: p.name, nickname: p.nickname || "", dorsal: String(p.dorsal), position: p.position, avatar_url: p.avatar_url }); setEditing(true); }}><Pencil size={15} color={colors.primary} /></Pressable>
        <Pressable onPress={remove}><Trash2 size={15} color={colors.danger} /></Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Stepper testID="add-goal-btn" label="Gol" value={p.goals} field="goals" color={colors.accent} id={p.id} reload={reload} />
        <Stepper testID="add-assist-btn" label="Asis" value={p.assists} field="assists" color={colors.primaryLight} id={p.id} reload={reload} />
        <Stepper testID="add-match-btn" label="PJ" value={p.matches_played} field="matches_played" color={colors.primary} id={p.id} reload={reload} />
        {isGK && <Stepper testID="add-conceded-btn" label="GC" value={p.goals_conceded || 0} field="goals_conceded" color={colors.danger} id={p.id} reload={reload} />}
      </View>
    </View>
  );
}

function CrestManager({ config, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const upload = async () => {
    const res = await pickFromGallery();
    if (res.status === "denied") { toast.error("Permiso denegado. Actívalo en Ajustes."); openSettings(); return; }
    if (res.status !== "ok" || !res.asset) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(res.asset);
      await api.put("/config", { club_crest_path: url });
      toast.success("Escudo actualizado");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Error al subir el escudo");
    } finally {
      setUploading(false);
    }
  };
  return (
    <Section icon={ImageIcon} title="Escudo del Club">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        {config.club_crest_path ? (
          <Image source={{ uri: fileUrl(config.club_crest_path)! }} contentFit="contain" style={{ width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} />
        ) : (
          <DefaultCrest size={64} primary={colors.primary} accent={colors.accent} card={colors.card} />
        )}
        <View style={{ flex: 1 }}>
          <FillBtn testID="club-crest-upload" onPress={upload} loading={uploading} icon={Upload} label="Subir escudo (foto)" />
        </View>
      </View>
    </Section>
  );
}

function ThemeManager({ config, reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const dark = !!config.dark_mode;
  const base = config.custom_colors || THEME_PRESETS[config.theme_preset] || THEME_PRESETS.navy_gold;
  const [primary, setPrimary] = useState(base.primary);
  const [accent, setAccent] = useState(base.accent);
  const [tertiary, setTertiary] = useState(base._tertiary || base.primaryLight);
  const [three, setThree] = useState(!!(config.custom_colors && config.custom_colors._tertiary));
  useEffect(() => {
    const b = config.custom_colors || THEME_PRESETS[config.theme_preset] || THEME_PRESETS.navy_gold;
    setPrimary(b.primary); setAccent(b.accent); setTertiary(b._tertiary || b.primaryLight);
    setThree(!!(config.custom_colors && config.custom_colors._tertiary));
  }, [config]);
  const usingCustom = !!config.custom_colors;

  const selectPreset = async (key: string) => {
    await api.put("/config", { theme_preset: key, custom_colors: null });
    toast.success("Tema actualizado");
    reload();
  };
  const applyCustom = async () => {
    const custom = buildCustomTheme(primary, accent, three ? tertiary : null);
    await api.put("/config", { custom_colors: custom });
    toast.success("Colores de tu equipo aplicados");
    reload();
  };
  const toggleDark = async () => {
    await api.put("/config", { dark_mode: !dark });
    toast.success(!dark ? "Modo oscuro activado" : "Modo claro activado");
    reload();
  };
  const applyDefault = async () => {
    await api.put("/config", { theme_preset: "futbase_oro", custom_colors: null, dark_mode: true });
    toast.success("Tema predeterminado (Futbase) aplicado");
    reload();
  };

  return (
    <Section icon={Palette} title="Colores de la App">
      <View style={{ marginBottom: 12 }}>
        <FillBtn testID="default-theme-btn" onPress={applyDefault} icon={Sparkles} label="Usar tema predeterminado (Futbase)" color="#C9A227" />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {dark ? <Moon size={18} color={colors.primary} /> : <Sun size={18} color={colors.accent} />}
          <View>
            <Text style={{ fontSize: 12.5, fontWeight: "800", color: colors.text }}>Modo oscuro</Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Fondo negro total</Text>
          </View>
        </View>
        <Pressable testID="dark-mode-toggle" onPress={toggleDark} style={{ width: 48, height: 28, borderRadius: 14, justifyContent: "center", backgroundColor: dark ? colors.primary : colors.border }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", marginLeft: dark ? 22 : 2 }} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, marginTop: 12 }} testID="color-preset-select">
        {Object.entries(THEME_PRESETS).map(([key, p]) => {
          const active = !usingCustom && config.theme_preset === key;
          return (
            <Pressable key={key} testID={`preset-${key}`} onPress={() => selectPreset(key)} style={{ width: "48.5%", padding: 10, borderRadius: 12, borderWidth: active ? 2 : 1, borderColor: active ? p.primary : colors.border, backgroundColor: colors.bg }}>
              <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: p.primary }} />
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: p.accent }} />
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: p.primaryLight }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>{p.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Divider label="colores de mi equipo (hex)" />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pressable testID="two-colors-btn" onPress={() => setThree(false)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: !three ? 2 : 1, borderColor: !three ? colors.primary : colors.border, alignItems: "center", backgroundColor: colors.bg }}>
          <Text style={{ fontWeight: "800", fontSize: 12, color: colors.text }}>2 colores</Text>
        </Pressable>
        <Pressable testID="three-colors-btn" onPress={() => setThree(true)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: three ? 2 : 1, borderColor: three ? colors.primary : colors.border, alignItems: "center", backgroundColor: colors.bg }}>
          <Text style={{ fontWeight: "800", fontSize: 12, color: colors.text }}>3 colores</Text>
        </Pressable>
      </View>
      <HexField label="Principal" value={primary} onChange={setPrimary} />
      <HexField label="Secundario" value={accent} onChange={setAccent} />
      {three && <HexField label="Terciario" value={tertiary} onChange={setTertiary} />}
      <View style={{ marginTop: 10 }}>
        <FillBtn testID="apply-custom-colors-btn" onPress={applyCustom} icon={Palette} label="Aplicar colores de mi equipo" color={primary} />
      </View>
    </Section>
  );
}

function HexField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const colors = useAppColors();
  const valid = /^#([0-9a-fA-F]{6})$/.test(value);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <Text style={{ width: 86, fontSize: 12.5, fontWeight: "700", color: colors.muted }}>{label}</Text>
      <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: valid ? value : colors.bg }} />
      <Input value={value} onChangeText={(v) => onChange(v.startsWith("#") ? v : `#${v}`)} autoCapitalize="none" placeholder="#RRGGBB" style={{ flex: 1, paddingVertical: 8 }} />
    </View>
  );
}

function ResetManager({ reload }: any) {
  const colors = useAppColors();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const doReset = async () => {
    if (confirmText.trim().toUpperCase() !== "BORRAR") return toast.error("Escribe BORRAR para confirmar");
    try {
      await api.post("/club/reset", { password: pin });
      toast.success("Equipo reiniciado");
      setOpen(false); setPin(""); setConfirmText("");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo reiniciar");
    }
  };
  return (
    <Section icon={AlertTriangle} title="Zona de Peligro">
      {!open ? (
        <Pressable testID="open-reset-btn" onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.danger }}>
          <AlertTriangle size={15} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: "800", fontSize: 13.5 }}>Reiniciar aplicación</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.danger }}>Esto borrará TODOS los equipos, partidos, jugadores y ajustes. No se puede deshacer.</Text>
          <Input testID="reset-pin-input" value={pin} onChangeText={setPin} secureTextEntry placeholder="Tu contraseña de entrenador" />
          <Input testID="reset-confirm-input" value={confirmText} onChangeText={setConfirmText} placeholder="Escribe BORRAR para confirmar" autoCapitalize="characters" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { setOpen(false); setPin(""); setConfirmText(""); }} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontWeight: "700" }}>Cancelar</Text>
            </Pressable>
            <Pressable testID="confirm-reset-btn" onPress={doReset} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.danger, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Borrar todo</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Section>
  );
}

const styles = (c: AppColors) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14, paddingBottom: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "800", color: c.text },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  section: { borderRadius: 18, padding: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: c.text },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
});
