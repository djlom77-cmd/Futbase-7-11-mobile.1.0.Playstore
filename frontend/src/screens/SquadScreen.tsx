import { useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { CalendarDays, Sparkles, Target, Users, X } from "lucide-react-native";

import { fileUrl } from "@/src/api";
import { DefaultCrest } from "@/src/components/Crest";
import { AppColors, useAppColors, useAppThemedStyles } from "@/src/theme";

type Player = {
  id: string;
  name: string;
  nickname?: string;
  dorsal: number;
  position: string;
  goals: number;
  assists: number;
  matches_played: number;
  goals_conceded?: number;
  avatar_url?: string | null;
};

const POSITIONS = ["Todos", "Portero", "Defensa", "Centrocampista", "Delantero"];

function Avatar({ player, size = 60, radius = 14 }: { player: Player; size?: number; radius?: number }) {
  const colors = useAppColors();
  const url = player.avatar_url ? fileUrl(player.avatar_url) : null;
  if (url) {
    return <Image source={{ uri: url }} contentFit="cover" style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.4 }}>{player.name?.[0] || "?"}</Text>
    </View>
  );
}

export default function SquadScreen({
  players,
  clubCrest,
  refreshing,
  onRefresh,
}: {
  players: Player[];
  clubCrest?: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  const [filter, setFilter] = useState("Todos");
  const [selected, setSelected] = useState<Player | null>(null);
  const list = filter === "Todos" ? players : players.filter((p) => p.position?.includes(filter) || p.position === filter);

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.titleRow}>
        <Users size={20} color={colors.primary} />
        <Text style={s.title}>Plantilla Alevín</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
        {POSITIONS.map((p) => {
          const active = p === filter;
          return (
            <Pressable key={p} testID={`squad-filter-${p}`} onPress={() => setFilter(p)} style={[s.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
              <Text style={[s.chipText, { color: active ? "#fff" : colors.muted }]}>{p}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.grid}>
        {list.map((p) => (
          <Pressable key={p.id} testID="player-card-item" onPress={() => setSelected(p)} style={s.cardWrap}>
            <View style={s.card}>
              <View style={s.crestTL}>
                <DefaultCrest size={20} primary={colors.primary} accent={colors.accent} card={colors.card} />
              </View>
              <Text style={[s.dorsalBg, { color: colors.primary }]}>{p.dorsal}</Text>
              <Avatar player={p} size={60} />
              <View style={{ marginTop: 8 }}>
                <Text style={[s.pName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                {!!p.nickname && <Text style={[s.pNick, { color: colors.accent }]}>&quot;{p.nickname}&quot;</Text>}
                <Text style={[s.pPos, { color: colors.muted }]}>{p.position}</Text>
              </View>
              <View style={[s.cardStats, { borderTopColor: colors.border }]}>
                <MiniStat value={p.goals} label="Goles" />
                <MiniStat value={p.position === "Portero" ? p.goals_conceded || 0 : p.assists} label={p.position === "Portero" ? "Enc." : "Asist."} />
                <MiniStat value={p.matches_played} label="PJ" />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      {list.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>No hay jugadores en esta demarcación.</Text>
        </View>
      )}

      <PlayerModal player={selected} clubCrest={clubCrest} onClose={() => setSelected(null)} />
    </ScrollView>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  const colors = useAppColors();
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontWeight: "900", fontSize: 17, color: colors.text }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: "800", textTransform: "uppercase", color: colors.muted }}>{label}</Text>
    </View>
  );
}

function PlayerModal({ player, clubCrest, onClose }: { player: Player | null; clubCrest?: string | null; onClose: () => void }) {
  const colors = useAppColors();
  const s = useAppThemedStyles(styles);
  if (!player) return null;
  const isGK = player.position === "Portero";
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={[s.modalCard, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()} testID="player-modal">
          <Pressable testID="close-player-modal" onPress={onClose} style={[s.modalClose, { backgroundColor: colors.bg }]}>
            <X size={18} color={colors.muted} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <View>
              <Avatar player={player} size={96} radius={18} />
              <View style={[s.dorsalChip, { backgroundColor: colors.accent }]}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{player.dorsal}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {clubCrest ? (
                  <Image source={{ uri: fileUrl(clubCrest)! }} contentFit="contain" style={{ width: 24, height: 24 }} />
                ) : (
                  <DefaultCrest size={24} primary={colors.primary} accent={colors.accent} card={colors.card} />
                )}
                <Text style={[s.modalName, { color: colors.text }]} numberOfLines={1}>{player.name}</Text>
              </View>
              {!!player.nickname && <Text style={{ fontStyle: "italic", color: colors.accent, marginTop: 2 }}>&quot;{player.nickname}&quot;</Text>}
              <View style={[s.posTag, { backgroundColor: colors.primary }]}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>{player.position}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <BigStat label="Goles" value={player.goals} color={colors.accent} bg={colors.bg} />
            <BigStat label={isGK ? "Encajados" : "Asistencias"} value={isGK ? player.goals_conceded || 0 : player.assists} color={colors.primary} bg={colors.bg} />
            <BigStat label="Partidos" value={player.matches_played} color={colors.primary} bg={colors.bg} />
          </View>

          <View style={s.modalFooter}>
            <Footer icon={Target} text={`Dorsal ${player.dorsal}`} />
            <Footer icon={Sparkles} text={player.position} />
            <Footer icon={CalendarDays} text={`${player.matches_played} PJ`} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BigStat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  const colors = useAppColors();
  return (
    <View style={{ flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: "center", backgroundColor: bg }}>
      <Text style={{ fontWeight: "900", fontSize: 26, color }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginTop: 4, color: colors.muted }}>{label}</Text>
    </View>
  );
}

function Footer({ icon: Icon, text }: { icon: any; text: string }) {
  const colors = useAppColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon size={13} color={colors.muted} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>{text}</Text>
    </View>
  );
}

const styles = (c: AppColors) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14, paddingBottom: 24 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: c.text },
  chipsRow: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, flexShrink: 0 },
  chipText: { fontSize: 12.5, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  cardWrap: { width: "48.5%" },
  card: { borderRadius: 18, padding: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, overflow: "hidden" },
  crestTL: { position: "absolute", top: 8, left: 8, opacity: 0.9, zIndex: 2 },
  dorsalBg: { position: "absolute", top: 4, right: 8, fontSize: 30, fontWeight: "900", opacity: 0.18 },
  pName: { fontWeight: "700", fontSize: 13.5 },
  pNick: { fontSize: 11, fontStyle: "italic" },
  pPos: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  cardStats: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between" },
  empty: { paddingVertical: 36, alignItems: "center" },
  emptyText: { color: c.muted, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(10,15,25,0.55)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 },
  modalClose: { position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 3 },
  dorsalChip: { position: "absolute", bottom: -8, right: -8, width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalName: { fontSize: 23, fontWeight: "800", flexShrink: 1 },
  posTag: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  modalFooter: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 16 },
});
