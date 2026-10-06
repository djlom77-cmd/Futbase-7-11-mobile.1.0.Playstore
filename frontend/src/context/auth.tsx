import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  authLogin,
  fetchMe,
  registerCoach as apiRegisterCoach,
  registerParent as apiRegisterParent,
  setToken,
} from "@/src/api";

export type User = {
  id: string;
  email: string;
  nombre?: string;
  equipo_id: string;
  rol: "ENTRENADOR" | "PADRE";
};

type AuthCtx = {
  user: User | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerCoach: (p: any) => Promise<void>;
  registerParent: (p: any) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMe();
        setUser(data.user);
      } catch {
        await setToken(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const finish = useCallback(async (data: any) => {
    await setToken(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => finish(await authLogin(email, password)), [finish]);
  const registerCoach = useCallback(async (p: any) => finish(await apiRegisterCoach(p)), [finish]);
  const registerParent = useCallback(async (p: any) => finish(await apiRegisterParent(p)), [finish]);
  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, registerCoach, registerParent, logout }),
    [user, booting, login, registerCoach, registerParent, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
