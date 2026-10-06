import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, XCircle, Info } from "lucide-react-native";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastCtx = {
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
};

const Ctx = createContext<ToastCtx>({ success: () => {}, error: () => {}, info: () => {} });

const COLORS: Record<ToastKind, string> = { success: "#16A34A", error: "#DC2626", info: "#1E3A5F" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, kind, message }]);
  }, []);

  const value = useMemo<ToastCtx>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]} testID="toast-host">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={() => setItems((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </View>
    </Ctx.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const h = setTimeout(onDone, 2600);
    return () => clearTimeout(h);
  }, [onDone]);
  const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "error" ? XCircle : Info;
  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp} style={[styles.toast, { backgroundColor: COLORS[item.kind] }]}>
      <Icon size={18} color="#fff" />
      <Text style={styles.text} numberOfLines={3}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    maxWidth: 440,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: "#fff", fontWeight: "700", fontSize: 13, flexShrink: 1 },
});
