import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, KeyRound, LogIn, UserPlus, Users } from "lucide-react-native";

import { fileUrl, forgotPassword, resetPassword } from "@/src/api";
import { DefaultCrest } from "@/src/components/Crest";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";
import { BRAND_KEY, FUTBASE_DARK } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Mode = "login" | "coach" | "parent" | "forgot" | "reset";

const C = FUTBASE_DARK;
const TITLES: Record<Mode, string> = {
  login: "Iniciar sesión",
  coach: "Crear equipo (Entrenador)",
  parent: "Unirme a un equipo (Padre/Madre)",
  forgot: "Recuperar contraseña",
  reset: "Nueva contraseña",
};

export default function AuthScreen() {
  const { login, registerCoach, registerParent } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ reset_token?: string }>();
  const resetToken = typeof params.reset_token === "string" ? params.reset_token : undefined;

  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nombre: "", club_name: "", invite_code: "" });
  const [brand, setBrand] = useState<{ name?: string; crest?: string | null }>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    storage.getItem<{ name?: string; crest?: string | null }>(BRAND_KEY, {}).then((b) => {
      if (b) setBrand(b);
    });
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else if (mode === "coach") await registerCoach({ email: form.email, password: form.password, nombre: form.nombre, club_name: form.club_name });
      else if (mode === "parent") await registerParent({ email: form.email, password: form.password, nombre: form.nombre, invite_code: form.invite_code });
      else if (mode === "forgot") {
        await forgotPassword(form.email);
        toast.success("Si el email está registrado, recibirás un enlace.");
        setMode("login");
      } else if (mode === "reset") {
        await resetPassword(resetToken || "", form.password);
        toast.success("Contraseña actualizada. Inicia sesión.");
        router.replace("/");
        setMode("login");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const Icon = mode === "login" ? LogIn : mode === "coach" ? UserPlus : mode === "parent" ? Users : KeyRound;
  const cta = mode === "login" ? "Entrar" : mode === "coach" ? "Crear equipo" : mode === "parent" ? "Unirme" : mode === "forgot" ? "Enviar enlace" : "Guardar";

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card} testID="auth-card">
          <View style={styles.head}>
            {brand.crest ? (
              <Image source={{ uri: fileUrl(brand.crest)! }} contentFit="contain" style={styles.brandCrest} />
            ) : (
              <DefaultCrest size={64} primary={C.accent} accent={C.primaryLight} card="#141414" />
            )}
            <Text style={styles.brand}>{brand.name || "FUTBASE-7-11"}</Text>
            <Text style={styles.sub}>{TITLES[mode]}</Text>
          </View>

          {(mode === "coach" || mode === "parent") && (
            <Field testID="auth-nombre" placeholder="Tu nombre" value={form.nombre} onChangeText={(v) => set("nombre", v)} />
          )}
          {mode === "coach" && (
            <Field testID="auth-club-name" placeholder="Nombre del club/equipo" value={form.club_name} onChangeText={(v) => set("club_name", v)} />
          )}
          {mode === "parent" && (
            <Field testID="auth-invite-code" placeholder="Código de equipo" autoCapitalize="characters" value={form.invite_code} onChangeText={(v) => set("invite_code", v)} />
          )}
          {mode !== "reset" && (
            <Field testID="auth-email" placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set("email", v)} />
          )}
          {mode !== "forgot" && (
            <Field
              testID="auth-password"
              placeholder={mode === "reset" ? "Nueva contraseña" : "Contraseña"}
              secureTextEntry
              value={form.password}
              onChangeText={(v) => set("password", v)}
            />
          )}

          <Pressable testID="auth-submit" onPress={submit} disabled={loading} style={({ pressed }) => [styles.submit, pressed && { opacity: 0.85 }]}>
            {loading ? <ActivityIndicator color="#141414" /> : <Icon size={18} color="#141414" />}
            <Text style={styles.submitText}>{cta}</Text>
          </Pressable>

          <View style={styles.links}>
            {mode === "login" ? (
              <>
                <Pressable testID="go-coach" onPress={() => setMode("coach")}>
                  <Text style={styles.linkStrong}>Soy entrenador — Crear equipo nuevo</Text>
                </Pressable>
                <Pressable testID="go-parent" onPress={() => setMode("parent")}>
                  <Text style={styles.linkStrong}>Soy padre/madre — Unirme con código</Text>
                </Pressable>
                <Pressable testID="go-forgot" onPress={() => setMode("forgot")}>
                  <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </>
            ) : (
              <Pressable testID="go-back-login" onPress={() => { setMode("login"); router.replace("/"); }} style={styles.backRow}>
                <ArrowLeft size={13} color={C.accent} />
                <Text style={styles.linkStrong}>Volver a iniciar sesión</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { testID: string }) {
  return <TextInput {...props} placeholderTextColor="#8A8A8E" style={styles.field} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0B" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20 },
  card: { width: "100%", maxWidth: 400, alignSelf: "center", borderRadius: 24, backgroundColor: "#161616", padding: 24, gap: 12, borderWidth: 1, borderColor: "#C9A22733" },
  head: { alignItems: "center", marginBottom: 6, gap: 4 },
  brandCrest: { width: 64, height: 64, borderRadius: 12 },
  brand: { fontSize: 26, fontWeight: "900", color: "#E3C457", textAlign: "center", letterSpacing: 0.5 },
  sub: { fontSize: 12, fontWeight: "600", color: "#B9A86A" },
  field: { width: "100%", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: "#2E2A1C", backgroundColor: "#1E1E20", color: "#F3F0E6", fontSize: 15 },
  submit: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14, backgroundColor: "#D4A52B" },
  submitText: { color: "#141414", fontWeight: "900", fontSize: 15 },
  links: { marginTop: 10, gap: 10, alignItems: "center" },
  link: { fontSize: 12.5, fontWeight: "600", color: "#9A8E63" },
  linkStrong: { fontSize: 12.5, fontWeight: "700", color: "#E3C457", textAlign: "center" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 5 },
});
