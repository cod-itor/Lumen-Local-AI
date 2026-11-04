import { NewChat } from "@/components/chat/new-chat";
import { getChatSuggestions } from "@/services/app";

/** Figma "01 · Chat · New" */
export default async function NewChatPage() {
  const suggestions = await getChatSuggestions();
  return <NewChat suggestions={suggestions} />;
}
