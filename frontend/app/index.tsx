import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/src/context/auth";
import AuthScreen from "@/src/screens/AuthScreen";
import HomeShell from "@/src/screens/HomeShell";
import { FUTBASE_DARK } from "@/src/theme";

export default function Index() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0B" }} testID="boot-loader">
        <ActivityIndicator size="large" color={FUTBASE_DARK.accent} />
      </View>
    );
  }

  return user ? <HomeShell /> : <AuthScreen />;
}
