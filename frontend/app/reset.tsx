import AuthScreen from "@/src/screens/AuthScreen";

// Deep-link target for password reset emails: /reset?reset_token=xxx
// AuthScreen reads the reset_token param and opens in "reset" mode.
export default function ResetRoute() {
  return <AuthScreen />;
}
