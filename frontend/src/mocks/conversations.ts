import type { AnswerBlock, Conversation, Source } from "@/types/chat";

/** Sources from Figma "Right Panel · Sources (open)". */
export const mockPhotosynthesisSources: Source[] = [
  {
    id: "src-wikipedia",
    index: 1,
    citeLabel: "Wikipedia",
    letter: "W",
    tone: "neutral",
    domain: "en.wikipedia.org",
    title: "Photosynthesis",
    snippet:
      "Photosynthesis is a process used by plants to convert light energy into chemical energy that fuels their activities.",
    url: "https://en.wikipedia.org/wiki/Photosynthesis",
  },
  {
    id: "src-khan",
    index: 2,
    citeLabel: "Khan Academy",
    letter: "K",
    tone: "teal",
    domain: "khanacademy.org",
    title: "Intro to photosynthesis",
    snippet: "Plants take in carbon dioxide and water and use energy from light to make glucose.",
    url: "https://www.khanacademy.org/science/biology/photosynthesis-in-plants",
  },
  {
    id: "src-natgeo",
    index: 3,
    citeLabel: "Nat Geo",
    letter: "N",
    tone: "yellow",
    domain: "nationalgeographic.org",
    title: "Photosynthesis: encyclopedic entry",
    snippet: "Oxygen is released when water molecules are split during the light reactions.",
    url: "https://education.nationalgeographic.org/resource/photosynthesis/",
  },
  {
    id: "src-britannica",
    index: 4,
    citeLabel: "Britannica",
    letter: "B",
    tone: "blue",
    domain: "britannica.com",
    title: "Photosynthesis: definition, formula & steps",
    snippet:
      "The overall equation is 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂, driven by light absorbed by chlorophyll.",
    url: "https://www.britannica.com/science/photosynthesis",
  },
];

/** Answer body from Figma "02 · Chat · Answer" (verbatim). */
export const mockPhotosynthesisAnswer: AnswerBlock[] = [
  {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "Photosynthesis is how plants make their own food. They use sunlight as energy to turn water and carbon dioxide into sugar, and give off oxygen along the way. ",
      },
      { type: "cite", sourceId: "src-wikipedia" },
    ],
  },
  {
    type: "list",
    items: [
      [
        { type: "strong", text: "Light." },
        { type: "text", text: " Chlorophyll in the leaves captures sunlight." },
      ],
      [
        { type: "strong", text: "Water and CO₂." },
        { type: "text", text: " Roots pull up water and leaves take in carbon dioxide. " },
        { type: "cite", sourceId: "src-khan" },
      ],
      [
        { type: "strong", text: "Food and oxygen." },
        { type: "text", text: " The plant makes glucose and releases oxygen. " },
        { type: "cite", sourceId: "src-natgeo" },
      ],
    ],
  },
  { type: "code", label: "equation", code: "6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂" },
  {
    type: "paragraph",
    content: [{ type: "text", text: "Want a quick quiz to check your understanding?" }],
  },
];

export const mockPhotosynthesisConversation: Conversation = {
  id: "photosynthesis",
  title: "Photosynthesis explained simply",
  messages: [
    { id: "m1", role: "user", text: "Explain how photosynthesis works in simple terms." },
    {
      id: "m2",
      role: "assistant",
      searchTrace: { en: "Searched 4 sites", km: "បានស្វែងរក 4 គេហទំព័រ" },
      blocks: mockPhotosynthesisAnswer,
      sourceIds: mockPhotosynthesisSources.map((s) => s.id),
    },
  ],
  sources: mockPhotosynthesisSources,
  searchSteps: {
    en: ["Searched the web", "Read 4 pages", "Wrote the answer with citations"],
    km: ["បានស្វែងរកលើអ៊ីនធឺណិត", "បានអាន 4 ទំព័រ", "បានសរសេរចម្លើយ ព្រមទាំងយោងប្រភព"],
  },
  searchQuery: "how photosynthesis works simply",
};

/** Fully authored conversations, by id. Other history ids reuse the sample answer. */
export const mockConversations: Record<string, Conversation> = {
  [mockPhotosynthesisConversation.id]: mockPhotosynthesisConversation,
};
