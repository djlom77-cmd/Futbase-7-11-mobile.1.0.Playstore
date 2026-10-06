import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

import { fileUrl } from "@/src/api";

// Pentagon-shield star crest. Inherits club colors; falls back to navy/gold.
export const DefaultCrest = memo(function DefaultCrest({
  size = 40,
  primary = "#1E3A5F",
  accent = "#D4A24C",
  card = "#FFFFFF",
}: {
  size?: number;
  primary?: string;
  accent?: string;
  card?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="50,4 93,21 81,86 50,99 19,86 7,21" fill={primary} stroke={accent} strokeWidth={4} />
      <Polygon points="50,15 83,28 72,79 50,89 28,79 17,28" fill={card} />
      <Circle cx={50} cy={47} r={19} fill={accent} />
      <Path d="M50 31 L54.5 43 L67 43 L57 51 L61 64 L50 56 L39 64 L43 51 L33 43 L45.5 43 Z" fill={primary} />
    </Svg>
  );
});

function initials(name?: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function TeamCrest({
  name,
  crest,
  size = 34,
  primary = "#1E3A5F",
  primaryLight = "#35557E",
}: {
  name?: string;
  crest?: string | null;
  size?: number;
  primary?: string;
  primaryLight?: string;
}) {
  const [err, setErr] = useState(false);
  const url = crest ? fileUrl(crest) : null;
  if (url && !err) {
    return (
      <Image
        source={{ uri: url }}
        onError={() => setErr(true)}
        contentFit="contain"
        style={{ width: size, height: size, borderRadius: 8, backgroundColor: "#fff" }}
      />
    );
  }
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: Math.round(size * 0.28), backgroundColor: primary, borderColor: primaryLight },
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.4 }}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
