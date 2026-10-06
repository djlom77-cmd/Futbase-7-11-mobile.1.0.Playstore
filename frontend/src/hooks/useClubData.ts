import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import type { User } from "@/src/context/auth";

const KEYS = ["config", "matches", "teams", "standings", "players", "jornada-dates"] as const;

export function useClubData(user: User | null) {
  const enabled = !!user;
  const qc = useQueryClient();
  const refetchInterval = user?.rol === "PADRE" ? 5000 : (false as const);

  const config = useQuery({ queryKey: ["config"], queryFn: () => api.get("/config"), enabled, refetchInterval });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => api.get("/matches"), enabled, refetchInterval });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => api.get("/teams"), enabled, refetchInterval });
  const standings = useQuery({ queryKey: ["standings"], queryFn: () => api.get("/standings"), enabled, refetchInterval });
  const players = useQuery({ queryKey: ["players"], queryFn: () => api.get("/players"), enabled, refetchInterval });
  const jornadaDates = useQuery({ queryKey: ["jornada-dates"], queryFn: () => api.get("/jornada-dates"), enabled, refetchInterval });

  const reload = () => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  return {
    config: config.data ?? { club_name: "Mi Equipo", subtitle: "Liga Educa" },
    matches: matches.data ?? [],
    teams: teams.data ?? [],
    standings: standings.data ?? [],
    players: players.data ?? [],
    jornadaDates: jornadaDates.data ?? {},
    loading: config.isLoading,
    refreshing: config.isFetching,
    reload,
  };
}
