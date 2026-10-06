import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/src/context/auth";
import AuthScreen from "@/src/screens/AuthScreen";
import HomeShell from "@/src/screens/HomeShell";
import { STATIC_NAVY } from "@/src/theme";

export default function Index() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#2A3844" }} testID="boot-loader">
        <ActivityIndicator size="large" color={STATIC_NAVY.white} />
      </View>
    );
  }

  return user ? <HomeShell /> : <AuthScreen />;
}
