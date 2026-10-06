import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MapPin, Trophy } from "lucide-react-native";

import { mapsUrl } from "@/src/api";
import { TeamCrest } from "@/src/components/Crest";
import { AppColors, useAppColors, useAppThemedStyles } from "@/src/theme";

type Row = {
  team: string;
  position: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
  venue_name?: string;
  address?: string;
  crest_path?: string | null;
};

export default function StandingsScreen({
  standings,
  myTeam,
  refreshing,
  onRefresh,
}: {
  standings: Row[];
  myTeam?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);

  const openMaps = (row: Row) => {
    const q = row.venue_name ? `${row.venue_name} ${row.address || ""}` : row.address || row.team;
    Linking.openURL(mapsUrl(q));
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.titleRow}>
        <Trophy size={20} color={colors.accent} />
        <Text style={s.title}>Clasificación</Text>
      </View>

      <View style={s.table}>
        <View style={[s.theadRow, { backgroundColor: colors.primary }]}>
          <Text style={[s.th, { width: 18, textAlign: "center" }]}>#</Text>
          <Text style={[s.th, { flex: 1 }]}>Equipo</Text>
          <Text style={[s.th, { width: 40, textAlign: "center" }]}>Pts</Text>
        </View>

        {standings.length === 0 && (
          <View style={s.emptyInline}>
            <Text style={s.emptyText}>Sin datos todavía</Text>
          </View>
        )}

        {standings.map((row) => {
          const isOurs = row.team === myTeam;
          let edge = "transparent";
          if (row.position === 1) edge = "#F59E0B";
          else if (row.position <= 3) edge = "#94A3B8";
          return (
            <Pressable
              key={row.team}
              testID="standings-row"
              onPress={() => openMaps(row)}
              style={[s.row, { borderLeftColor: edge, backgroundColor: colors.card }]}
            >
              <View style={s.rowMain}>
                <Text style={[s.pos, { color: colors.muted }]}>{row.position}</Text>
                <TeamCrest name={row.team} crest={row.crest_path} size={30} primary={colors.primary} primaryLight={colors.primaryLight} />
                <View style={s.teamWrap}>
                  <Text style={[s.teamName, { color: colors.text }]} numberOfLines={1}>{row.team}</Text>
                  {isOurs && <MapPin size={12} color={colors.accent} />}
                </View>
                <View style={s.ptsBox}>
                  <Text style={[s.pts, { color: colors.primary }]}>{row.pts}</Text>
                  <Text style={[s.ptsLabel, { color: colors.muted }]}>Pts</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <Stat label="PJ" value={row.pj} />
                <Stat label="G" value={row.pg} />
                <Stat label="E" value={row.pe} />
                <Stat label="P" value={row.pp} />
                <Stat label="GF" value={row.gf} />
                <Stat label="GC" value={row.gc} />
                <Stat label="DG" value={row.dg > 0 ? `+${row.dg}` : row.dg} color={row.dg > 0 ? colors.success : row.dg < 0 ? colors.danger : colors.text} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.hint}>Toca un equipo para ver su campo en Google Maps</Text>
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  const colors = useAppColors();
  return (
    <Text style={{ fontSize: 11 }}>
      <Text style={{ color: colors.muted }}>{label} </Text>
      <Text style={{ fontWeight: "700", color: color || colors.text }}>{value}</Text>
    </Text>
  );
}

const styles = (c: AppColors) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14, paddingBottom: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: c.text },
  table: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  theadRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  th: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  emptyInline: { paddingVertical: 36, alignItems: "center" },
  emptyText: { color: c.muted, fontWeight: "600" },
  row: { paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, borderLeftWidth: 4 },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  pos: { width: 18, textAlign: "center", fontSize: 13, fontWeight: "700" },
  teamWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  teamName: { fontSize: 13.5, fontWeight: "700", flexShrink: 1 },
  ptsBox: { width: 40, alignItems: "center" },
  pts: { fontSize: 22, fontWeight: "900", lineHeight: 24 },
  ptsLabel: { fontSize: 8, fontWeight: "800", textTransform: "uppercase" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6, paddingLeft: 42 },
  hint: { fontSize: 11, textAlign: "center", color: c.muted },
});
