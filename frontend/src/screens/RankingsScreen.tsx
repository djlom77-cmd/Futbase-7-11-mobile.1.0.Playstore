import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Flame, Zap } from "lucide-react-native";

import { fileUrl } from "@/src/api";
import { AppColors, useAppColors, useAppThemedStyles } from "@/src/theme";

type Player = { id: string; name: string; goals: number; assists: number; avatar_url?: string | null };

const medal = (i: number, muted: string) => (i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#B45309" : muted);

export default function RankingsScreen({
  players,
  refreshing,
  onRefresh,
}: {
  players: Player[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  const [tab, setTab] = useState<"goals" | "assists">("goals");
  const sorted = [...players].filter((p) => (p[tab] || 0) > 0).sort((a, b) => b[tab] - a[tab]);
  const max = sorted.length ? sorted[0][tab] : 0;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.titleRow}>
        <Flame size={20} color={colors.accent} />
        <Text style={s.title}>Rankings del Equipo</Text>
      </View>

      <View style={s.segment}>
        {[
          { id: "goals" as const, label: "Pichichi", icon: Flame },
          { id: "assists" as const, label: "Asistencias", icon: Zap },
        ].map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <Pressable key={t.id} testID={`ranking-tab-${t.id}`} onPress={() => setTab(t.id)} style={[s.seg, active && { backgroundColor: colors.card }]}>
              <Icon size={15} color={active ? colors.primary : colors.muted} />
              <Text style={{ fontWeight: "700", fontSize: 13.5, color: active ? colors.primary : colors.muted }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.panel}>
        {sorted.length === 0 ? (
          <Text style={s.emptyText}>Todavía no hay registros.</Text>
        ) : (
          sorted.map((p, i) => <Bar key={p.id} player={p} value={p[tab]} max={max} i={i} />)
        )}
      </View>
    </ScrollView>
  );
}

function Bar({ player, value, max, i }: { player: Player; value: number; max: number; i: number }) {
  const colors = useAppColors();
  const pct = max > 0 ? Math.max(8, (value / max) * 100) : 8;
  const url = player.avatar_url ? fileUrl(player.avatar_url) : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ fontWeight: "900", fontSize: 17, width: 24, textAlign: "center", color: medal(i, colors.muted) }}>{i + 1}</Text>
      {url ? (
        <Image source={{ uri: url }} contentFit="cover" style={{ width: 40, height: 40, borderRadius: 20 }} />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>{player.name?.[0]}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
          <Text style={{ fontWeight: "700", fontSize: 13.5, color: colors.text, flexShrink: 1 }} numberOfLines={1}>{player.name}</Text>
          <Text style={{ fontWeight: "900", fontSize: 15, color: colors.primary, marginLeft: 8 }}>{value}</Text>
        </View>
        <View style={{ height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: colors.border }}>
          <View style={{ height: "100%", borderRadius: 999, width: `${pct}%`, backgroundColor: i === 0 ? colors.accent : colors.primaryLight }} />
        </View>
      </View>
    </View>
  );
}

const styles = (c: AppColors) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14, paddingBottom: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: c.text },
  segment: { flexDirection: "row", gap: 8, padding: 4, borderRadius: 14, backgroundColor: c.border },
  seg: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  panel: { borderRadius: 18, padding: 16, gap: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  emptyText: { paddingVertical: 20, textAlign: "center", color: c.muted, fontWeight: "600" },
});
