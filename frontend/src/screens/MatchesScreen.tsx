import { useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CalendarDays, CalendarRange, LayoutGrid, MapPin } from "lucide-react-native";

import { formatDate, mapsUrl } from "@/src/api";
import { TeamCrest } from "@/src/components/Crest";
import { AppColors, useAppColors, useAppThemedStyles } from "@/src/theme";

type Match = {
  id: string;
  jornada: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};
type Team = { name: string; venue_name?: string; address?: string; crest_path?: string | null };

const STATUS: Record<string, { c: string; bg: string; t: string }> = {
  FINALIZADO: { c: "#16A34A", bg: "#DCFCE7", t: "Finalizado" },
  "EN JUEGO": { c: "#DC2626", bg: "#FEE2E2", t: "En juego" },
  "PRÓXIMO": { c: "#64748B", bg: "#F1F5F9", t: "Próximo" },
};

function openMaps(meta: Team | undefined, name: string) {
  const q = meta?.venue_name ? `${meta.venue_name} ${meta.address || ""}` : meta?.address || name;
  Linking.openURL(mapsUrl(q));
}

export default function MatchesScreen({
  matches,
  teams,
  jornadaDates,
  myTeam,
  refreshing,
  onRefresh,
}: {
  matches: Match[];
  teams: Team[];
  jornadaDates: Record<string, string>;
  myTeam?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  const jornadas = useMemo(() => [...new Set(matches.map((m) => m.jornada))].sort((a, b) => a - b), [matches]);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<"jornada" | "calendar">("jornada");
  const activeJornada = selected ?? (jornadas.length ? jornadas[jornadas.length - 1] : null);
  const list = matches.filter((m) => m.jornada === activeJornada);

  const next = useMemo(() => {
    if (!myTeam) return null;
    const up = matches
      .filter((m) => (m.home_team === myTeam || m.away_team === myTeam) && m.home_score == null && m.away_score == null)
      .sort((a, b) => a.jornada - b.jornada);
    return up[0] || null;
  }, [matches, myTeam]);

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.titleRow}>
        <CalendarDays size={20} color={colors.primary} />
        <Text style={s.title}>Enfrentamientos</Text>
      </View>

      {next && <NextMatch match={next} teams={teams} />}

      <View style={s.segment}>
        <SegBtn id="jornada" icon={LayoutGrid} label="Por jornada" view={view} setView={setView} />
        <SegBtn id="calendar" icon={CalendarRange} label="Calendario" view={view} setView={setView} />
      </View>

      {view === "calendar" ? (
        <CalendarView matches={matches} teams={teams} jornadaDates={jornadaDates} myTeam={myTeam} />
      ) : jornadas.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Aún no hay jornadas. El entrenador puede subir resultados desde el panel.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} testID="jornada-selector">
            {jornadas.map((j) => {
              const active = j === activeJornada;
              return (
                <Pressable key={j} testID={`jornada-chip-${j}`} onPress={() => setSelected(j)} style={[s.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
                  <Text style={[s.chipText, { color: active ? "#fff" : colors.muted }]}>Jornada {j}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeJornada != null && jornadaDates[activeJornada] && (
            <View style={s.dateRow}>
              <CalendarDays size={13} color={colors.primary} />
              <Text style={s.dateText}>{formatDate(jornadaDates[activeJornada])}</Text>
            </View>
          )}

          <View style={{ gap: 12 }}>
            {list.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} myTeam={myTeam} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SegBtn({ id, icon: Icon, label, view, setView }: any) {
  const colors = useAppColors();
  const active = view === id;
  return (
    <Pressable testID={`view-${id}-btn`} onPress={() => setView(id)} style={[segStyle.btn, active && { backgroundColor: colors.card }]}>
      <Icon size={15} color={active ? colors.primary : colors.muted} />
      <Text style={{ fontWeight: "700", fontSize: 13.5, color: active ? colors.primary : colors.muted }}>{label}</Text>
    </Pressable>
  );
}

function NextMatch({ match, teams }: { match: Match; teams: Team[] }) {
  const colors = useAppColors();
  const homeMeta = teams.find((t) => t.name === match.home_team);
  const awayMeta = teams.find((t) => t.name === match.away_team);
  return (
    <View testID="next-match-banner" style={[nm.card, { backgroundColor: colors.primaryDark }]}>
      <View style={nm.head}>
        <Text style={nm.label}>Próximo partido de mi equipo</Text>
        <View style={[nm.jBadge, { backgroundColor: colors.accent }]}>
          <Text style={nm.jBadgeText}>Jornada {match.jornada}</Text>
        </View>
      </View>
      <View style={nm.row}>
        <View style={nm.side}>
          <TeamCrest name={match.home_team} crest={homeMeta?.crest_path} size={42} primary={colors.primary} primaryLight={colors.primaryLight} />
          <Text style={nm.team}>{match.home_team}</Text>
        </View>
        <Text style={nm.vs}>VS</Text>
        <View style={nm.side}>
          <TeamCrest name={match.away_team} crest={awayMeta?.crest_path} size={42} primary={colors.primary} primaryLight={colors.primaryLight} />
          <Text style={nm.team}>{match.away_team}</Text>
        </View>
      </View>
      <Pressable testID="next-match-maps-btn" onPress={() => openMaps(homeMeta, match.home_team)} style={nm.mapsBtn}>
        <MapPin size={15} color="#fff" />
        <Text style={nm.mapsText}>{homeMeta?.venue_name || "Campo"} — Ver en Maps</Text>
      </Pressable>
    </View>
  );
}

function MatchCard({ match, teams, myTeam }: { match: Match; teams: Team[]; myTeam?: string }) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  const isOurs = match.home_team === myTeam || match.away_team === myTeam;
  const hasScore = match.home_score !== null && match.away_score !== null;
  const homeMeta = teams.find((t) => t.name === match.home_team);
  const awayMeta = teams.find((t) => t.name === match.away_team);
  const st = STATUS[match.status] || STATUS["PRÓXIMO"];
  return (
    <View testID="match-card" style={[s.matchCard, { borderColor: isOurs ? colors.accent : colors.border, borderWidth: isOurs ? 2 : 1 }]}>
      <View style={s.matchTop}>
        <View style={[s.pill, { backgroundColor: st.bg }]}>
          <Text style={[s.pillText, { color: st.c }]}>{st.t.toUpperCase()}</Text>
        </View>
        {isOurs && (
          <View style={[s.pill, { backgroundColor: colors.accent }]}>
            <Text style={[s.pillText, { color: "#fff" }]}>NUESTRO EQUIPO</Text>
          </View>
        )}
      </View>
      <View style={s.matchBody}>
        <Pressable testID="open-maps-btn" onPress={() => openMaps(homeMeta, match.home_team)} style={s.matchSide}>
          <TeamCrest name={match.home_team} crest={homeMeta?.crest_path} size={44} primary={colors.primary} primaryLight={colors.primaryLight} />
          <Text style={s.matchTeam} numberOfLines={2}>{match.home_team}</Text>
        </Pressable>
        <View style={s.scoreBox}>
          {hasScore ? (
            <Text style={s.score}>
              {match.home_score}
              <Text style={{ color: colors.muted }}> - </Text>
              {match.away_score}
            </Text>
          ) : (
            <Text style={[s.score, { color: colors.muted }]}>VS</Text>
          )}
        </View>
        <Pressable testID="open-maps-btn" onPress={() => openMaps(awayMeta, match.away_team)} style={s.matchSide}>
          <TeamCrest name={match.away_team} crest={awayMeta?.crest_path} size={44} primary={colors.primary} primaryLight={colors.primaryLight} />
          <Text style={s.matchTeam} numberOfLines={2}>{match.away_team}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => openMaps(homeMeta, match.home_team)} style={s.campoRow}>
        <MapPin size={13} color={colors.primary} />
        <Text style={[s.campoText, { color: colors.primary }]}>Campo local</Text>
      </Pressable>
    </View>
  );
}

function CalendarView({ matches, teams, jornadaDates, myTeam }: any) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  const jornadas = [...new Set(matches.map((m: Match) => m.jornada))].sort((a: number, b: number) => a - b) as number[];
  if (!jornadas.length) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Aún no hay jornadas registradas.</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 18 }} testID="calendar-view">
      {jornadas.map((j) => (
        <View key={j}>
          <View style={s.calHead}>
            <View style={[s.jTag, { backgroundColor: colors.primary }]}>
              <Text style={s.jTagText}>J{j}</Text>
            </View>
            {jornadaDates[j] && (
              <View style={s.dateRow}>
                <CalendarDays size={13} color={colors.primary} />
                <Text style={s.dateText}>{formatDate(jornadaDates[j])}</Text>
              </View>
            )}
          </View>
          <View style={[s.calGroup, { borderColor: colors.border }]}>
            {matches
              .filter((m: Match) => m.jornada === j)
              .map((m: Match) => {
                const isOurs = m.home_team === myTeam || m.away_team === myTeam;
                const hasScore = m.home_score !== null && m.away_score !== null;
                const hm = teams.find((t: Team) => t.name === m.home_team);
                const am = teams.find((t: Team) => t.name === m.away_team);
                return (
                  <View key={m.id} testID="calendar-match-row" style={[s.calRow, { borderLeftColor: isOurs ? colors.accent : "transparent" }]}>
                    <Text style={[s.calTeamR]} numberOfLines={1}>{m.home_team}</Text>
                    <TeamCrest name={m.home_team} crest={hm?.crest_path} size={22} primary={colors.primary} primaryLight={colors.primaryLight} />
                    <Text style={[s.calScore, { color: hasScore ? colors.text : colors.muted }]}>{hasScore ? `${m.home_score}-${m.away_score}` : "VS"}</Text>
                    <TeamCrest name={m.away_team} crest={am?.crest_path} size={22} primary={colors.primary} primaryLight={colors.primaryLight} />
                    <Text style={[s.calTeamL]} numberOfLines={1}>{m.away_team}</Text>
                  </View>
                );
              })}
          </View>
        </View>
      ))}
    </View>
  );
}

const segStyle: any = {
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
};

const nm: any = {
  card: { borderRadius: 18, padding: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  jBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  jBadgeText: { color: "#1a1a1a", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginVertical: 12 },
  side: { flex: 1, alignItems: "center", gap: 6 },
  team: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  vs: { color: "rgba(255,255,255,0.7)", fontWeight: "900", fontSize: 20 },
  mapsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)" },
  mapsText: { color: "#fff", fontWeight: "700", fontSize: 13 },
};

const styles = (c: AppColors) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: c.text },
  segment: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 14, backgroundColor: c.border },
  empty: { paddingVertical: 48, borderRadius: 18, backgroundColor: c.card, alignItems: "center", paddingHorizontal: 20 },
  emptyText: { color: c.muted, fontWeight: "600", textAlign: "center" },
  chipsRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, flexShrink: 0 },
  chipText: { fontSize: 13.5, fontWeight: "700" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { color: c.muted, fontWeight: "600", fontSize: 12.5, textTransform: "capitalize" },
  matchCard: { borderRadius: 18, padding: 16, backgroundColor: c.card },
  matchTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 },
  matchBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  matchSide: { flex: 1, alignItems: "center", gap: 6 },
  matchTeam: { fontSize: 12, fontWeight: "600", textAlign: "center", color: c.text },
  scoreBox: { paddingHorizontal: 8, alignItems: "center" },
  score: { fontSize: 32, fontWeight: "900", color: c.text },
  campoRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  campoText: { fontSize: 11.5, fontWeight: "700" },
  calHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  jTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  jTagText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  calGroup: { borderRadius: 18, borderWidth: 1, overflow: "hidden", backgroundColor: c.card },
  calRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, borderLeftWidth: 3 },
  calTeamR: { flex: 1, textAlign: "right", fontSize: 12, fontWeight: "600", color: c.text },
  calTeamL: { flex: 1, textAlign: "left", fontSize: 12, fontWeight: "600", color: c.text },
  calScore: { width: 44, textAlign: "center", fontWeight: "900", fontSize: 13 },
});
