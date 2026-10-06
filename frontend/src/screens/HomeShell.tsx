import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, Flame, LogOut, ShieldCheck, Trophy, Users } from "lucide-react-native";

import { fileUrl } from "@/src/api";
import { DefaultCrest } from "@/src/components/Crest";
import { useAuth } from "@/src/context/auth";
import { useClubData } from "@/src/hooks/useClubData";
import AdminScreen from "@/src/screens/AdminScreen";
import MatchesScreen from "@/src/screens/MatchesScreen";
import RankingsScreen from "@/src/screens/RankingsScreen";
import SquadScreen from "@/src/screens/SquadScreen";
import StandingsScreen from "@/src/screens/StandingsScreen";
import { useAppColors, useSetTheme, BRAND_KEY } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type TabId = "jornada" | "clasificacion" | "plantilla" | "rankings" | "admin";
const BASE_TABS: { id: TabId; label: string; icon: any; testId: string }[] = [
  { id: "jornada", label: "Partidos", icon: CalendarDays, testId: "nav-tab-matches" },
  { id: "clasificacion", label: "Tabla", icon: Trophy, testId: "nav-tab-standings" },
  { id: "plantilla", label: "Plantilla", icon: Users, testId: "nav-tab-squad" },
  { id: "rankings", label: "Rankings", icon: Flame, testId: "nav-tab-stats" },
];
const ADMIN_TAB = { id: "admin" as TabId, label: "Míster", icon: ShieldCheck, testId: "nav-tab-admin" };

export default function HomeShell() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const setTheme = useSetTheme();
  const [tab, setTab] = useState<TabId>("jornada");
  const data = useClubData(user);
  const { config } = data;

  useEffect(() => {
    setTheme({ theme_preset: config.theme_preset, custom_colors: config.custom_colors, dark_mode: config.dark_mode });
  }, [config.theme_preset, config.custom_colors, config.dark_mode, setTheme]);

  // Cache the club branding so the login "portada" shows the club name + crest.
  useEffect(() => {
    if (config.club_name && config.club_name !== "Mi Equipo") {
      storage.setItem(BRAND_KEY, { name: config.club_name, crest: config.club_crest_path ?? null });
    }
  }, [config.club_name, config.club_crest_path]);

  const isCoach = user?.rol === "ENTRENADOR";
  const tabs = isCoach ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;
  const crestUrl = config.club_crest_path ? fileUrl(config.club_crest_path) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top, height: 72 + insets.top }]}
      >
        <View style={styles.headerLeft}>
          {crestUrl ? (
            <Image source={{ uri: crestUrl }} contentFit="contain" style={styles.crestImg} />
          ) : (
            <DefaultCrest size={44} primary={colors.primary} accent={colors.accent} card={colors.card} />
          )}
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.clubName} numberOfLines={1}>{config.club_name}</Text>
            <View style={styles.subRow}>
              <Text style={styles.subText} numberOfLines={1}>{config.subtitle || "Liga Educa"}</Text>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={styles.subText}>{isCoach ? "Entrenador" : "Padre/Madre"}</Text>
            </View>
          </View>
        </View>
        <Pressable testID="header-logout-btn" onPress={logout} style={styles.logout}>
          <LogOut size={16} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "jornada" && (
          <MatchesScreen matches={data.matches} teams={data.teams} jornadaDates={data.jornadaDates} myTeam={config.my_team} refreshing={data.refreshing} onRefresh={data.reload} />
        )}
        {tab === "clasificacion" && (
          <StandingsScreen standings={data.standings} myTeam={config.my_team} refreshing={data.refreshing} onRefresh={data.reload} />
        )}
        {tab === "plantilla" && (
          <SquadScreen players={data.players} clubCrest={config.club_crest_path} refreshing={data.refreshing} onRefresh={data.reload} />
        )}
        {tab === "rankings" && <RankingsScreen players={data.players} refreshing={data.refreshing} onRefresh={data.reload} />}
        {tab === "admin" && isCoach && (
          <AdminScreen config={config} players={data.players} teams={data.teams} matches={data.matches} jornadaDates={data.jornadaDates} reload={data.reload} onLogout={logout} />
        )}
      </View>

      {/* Bottom nav */}
      <View style={[styles.nav, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 6 }]}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <Pressable key={t.id} testID={t.testId} onPress={() => setTab(t.id)} style={styles.navItem}>
              <View style={[styles.navIcon, { backgroundColor: active ? colors.primary : "transparent" }]}>
                <Icon size={19} color={active ? "#fff" : colors.muted} />
              </View>
              <Text style={[styles.navLabel, { color: active ? colors.primary : colors.muted }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  crestImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)" },
  clubName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  subText: { color: "rgba(255,255,255,0.82)", fontSize: 11 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  logout: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  nav: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around", paddingTop: 8, borderTopWidth: 1 },
  navItem: { flex: 1, alignItems: "center", gap: 2 },
  navIcon: { width: 40, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  navLabel: { fontSize: 10, fontWeight: "800" },
});
