import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getAiSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Settings — Lumen",
  description: "Your account, the model that answers you, language, appearance and privacy.",
};

export default async function SettingsPage() {
  const ai = await getAiSettings();
  return <SettingsView content={ai} />;
}
