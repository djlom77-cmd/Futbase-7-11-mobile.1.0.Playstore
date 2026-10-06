import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, KeyRound, LogIn, UserPlus, Users } from "lucide-react-native";

import { forgotPassword, resetPassword } from "@/src/api";
import { useAuth } from "@/src/context/auth";
import { useToast } from "@/src/context/toast";

type Mode = "login" | "coach" | "parent" | "forgot" | "reset";

const LOGO = require("../../assets/images/futbase-logo.png");
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
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={LOGO} contentFit="contain" style={styles.logo} testID="futbase-logo" />

        <View style={styles.card} testID="auth-card">
          <Text style={styles.brand}>Futbase 7-11</Text>
          <Text style={styles.sub}>{TITLES[mode]}</Text>

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

          <Pressable testID="auth-submit" onPress={submit} disabled={loading} style={({ pressed }) => [styles.submitWrap, pressed && { opacity: 0.9 }]}>
            <LinearGradient colors={["#F3D778", "#D9A72C", "#A9741A"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.submit}>
              {loading ? <ActivityIndicator color="#1A1206" /> : <Icon size={18} color="#1A1206" />}
              <Text style={styles.submitText}>{cta}</Text>
            </LinearGradient>
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
                <ArrowLeft size={13} color="#E3C457" />
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
  return <TextInput {...props} placeholderTextColor="#9A9A9E" style={styles.field} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0B" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 18, alignItems: "center" },
  logo: { width: 248, height: 226, marginBottom: -46, zIndex: 2 },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 30,
    backgroundColor: "#343638",
    paddingTop: 58,
    paddingBottom: 26,
    paddingHorizontal: 22,
    gap: 12,
    alignItems: "center",
  },
  brand: { fontSize: 30, fontWeight: "900", color: "#E6C25A", textAlign: "center", letterSpacing: 0.5 },
  sub: { fontSize: 13, fontWeight: "600", color: "#A8A8AC", marginBottom: 6 },
  field: {
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#B98E2E",
    backgroundColor: "transparent",
    color: "#F3F0E6",
    fontSize: 15,
  },
  submitWrap: { width: "100%", marginTop: 6, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#7A5A12" },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  submitText: { color: "#1A1206", fontWeight: "900", fontSize: 16 },
  links: { marginTop: 12, gap: 12, alignItems: "center" },
  link: { fontSize: 13, fontWeight: "600", color: "#A8A8AC" },
  linkStrong: { fontSize: 13, fontWeight: "600", color: "#C9C9CD", textAlign: "center" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 5 },
});
