import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";

export type PickedAsset = { uri: string; fileName?: string | null; mimeType?: string | null };

type PickResult = { asset?: PickedAsset; status: "ok" | "cancelled" | "denied" };

/**
 * Pick an image from the gallery, requesting permission contextually.
 * Returns status so the caller can show "Open Settings" on permanent denial.
 */
export async function pickFromGallery(): Promise<PickResult> {
  const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
  let status = perm.status;
  let canAskAgain = perm.canAskAgain;
  if (status !== "granted") {
    const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
    status = req.status;
    canAskAgain = req.canAskAgain;
  }
  if (status !== "granted") {
    if (!canAskAgain) return { status: "denied" };
    return { status: "denied" };
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    allowsEditing: false,
  });
  if (res.canceled || !res.assets?.length) return { status: "cancelled" };
  const a = res.assets[0];
  return { status: "ok", asset: { uri: a.uri, fileName: a.fileName, mimeType: a.mimeType } };
}

export async function pickFromCamera(): Promise<PickResult> {
  const perm = await ImagePicker.getCameraPermissionsAsync();
  let status = perm.status;
  let canAskAgain = perm.canAskAgain;
  if (status !== "granted") {
    const req = await ImagePicker.requestCameraPermissionsAsync();
    status = req.status;
    canAskAgain = req.canAskAgain;
  }
  if (status !== "granted") return { status: "denied" };
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
  if (res.canceled || !res.assets?.length) return { status: "cancelled" };
  const a = res.assets[0];
  return { status: "ok", asset: { uri: a.uri, fileName: a.fileName, mimeType: a.mimeType } };
}

export const openSettings = () => Linking.openSettings();
