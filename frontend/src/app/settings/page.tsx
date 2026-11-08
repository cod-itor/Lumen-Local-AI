import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getCurrentUser } from "@/services/app";
import { getAiSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Settings — Lumen",
  description: "Which AI models run Lumen on your computer, what each one does, and the rules Lumen gives them.",
};

export default async function SettingsPage() {
  const [ai, user] = await Promise.all([getAiSettings(), getCurrentUser()]);
  return <SettingsView content={ai} user={user} />;
}
