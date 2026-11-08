import type { Metadata } from "next";
import { ModelsManager } from "@/components/settings/models-manager";

export const metadata: Metadata = {
  title: "Your models — Lumen",
  description: "Choose the model that answers your chats: the host model, a model in your browser, or your own Ollama.",
};

export default function ModelsPage() {
  return <ModelsManager />;
}
