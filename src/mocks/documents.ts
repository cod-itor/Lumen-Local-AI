import type {
  DocumentChatSummary,
  DocumentThread,
  Material,
  MaterialPage,
} from "@/types/documents";

/** Sidebar "Shared materials". */
export const mockMaterials: Material[] = [
  {
    id: "biology-ch2-cells",
    name: "Biology_Ch2_Cells.pdf",
    kind: "pdf",
    pages: 18,
    sharedBy: "Ms. Dara",
    status: "ready",
  },
  {
    id: "khmer-literature-notes",
    name: "Khmer_Literature_Notes.docx",
    kind: "docx",
    pages: 6,
    sharedBy: "Mr. Vibol",
    status: "ready",
  },
  {
    id: "physics-lecture-05",
    name: "Physics_Lecture_05.pdf",
    kind: "pdf",
    pages: 24,
    sharedBy: "Ms. Dara",
    status: "ready",
  },
  { id: "python-cheatsheet", name: "Python_Cheatsheet.md", kind: "md", status: "ready" },
  {
    id: "history-timeline",
    name: "History_Timeline.txt",
    kind: "txt",
    status: "embedding",
    progress: 64,
  },
];

/** Sidebar "Recents" (document chats). */
export const mockDocumentChats: DocumentChatSummary[] = [
  { id: "explain-ch2", title: "Explain chapter 2 simply", materialId: "biology-ch2-cells" },
  { id: "physics-5", title: "Summarize physics lecture 5", materialId: "physics-lecture-05" },
  { id: "khmer-poems", title: "Quiz me on Khmer poems", materialId: "khmer-literature-notes" },
];

/** The page shown in the file viewer for each material. */
export const mockMaterialPages: MaterialPage[] = [
  {
    materialId: "biology-ch2-cells",
    page: 3,
    blocks: [
      { type: "eyebrow", text: "CHAPTER 2 · CELL STRUCTURE" },
      { type: "title", text: "2.3  The Cell Membrane" },
      {
        type: "paragraph",
        text: "Every cell is surrounded by a thin, flexible boundary called the cell membrane. It separates the inside of the cell from its environment and controls what can enter or leave.",
      },
      {
        type: "highlight",
        id: "bio-membrane",
        text: "The membrane is made of a double layer of phospholipids. Each phospholipid has a water-loving head and two water-fearing tails. Proteins float within this layer like boats on a sea.",
      },
      {
        type: "paragraph",
        text: "Small molecules such as oxygen and carbon dioxide pass through easily. Larger or charged particles need help from transport proteins.",
      },
      { type: "heading", text: "2.4  Transport Across the Membrane" },
      {
        type: "paragraph",
        text: "Cells move materials in two main ways: passive transport, which needs no energy, and active transport, which uses energy from ATP.",
      },
    ],
  },
  {
    materialId: "physics-lecture-05",
    page: 1,
    blocks: [
      { type: "eyebrow", text: "LECTURE 5 · FORCES AND MOTION" },
      { type: "title", text: "5.1  Newton’s Laws" },
      {
        type: "paragraph",
        text: "An object stays at rest, or keeps moving in a straight line at constant speed, unless a net force acts on it.",
      },
      {
        type: "highlight",
        id: "phys-second-law",
        text: "The acceleration of an object is proportional to the net force on it and inversely proportional to its mass: F = m × a.",
      },
      {
        type: "paragraph",
        text: "For every action there is an equal and opposite reaction.",
      },
    ],
  },
  {
    materialId: "khmer-literature-notes",
    page: 1,
    blocks: [
      { type: "eyebrow", text: "KHMER LITERATURE · UNIT 1" },
      { type: "title", text: "1.1  Classical Poetry" },
      {
        type: "paragraph",
        text: "Classical Khmer poems follow strict meters that set the number of syllables in each line and how lines rhyme with each other.",
      },
      {
        type: "highlight",
        id: "khmer-meter",
        text: "The Bat Kakagati meter uses four syllables per line, and the last syllable of one line rhymes with a syllable in the next.",
      },
    ],
  },
  {
    materialId: "python-cheatsheet",
    page: 1,
    blocks: [
      { type: "title", text: "Python Cheatsheet" },
      { type: "heading", text: "Loops" },
      {
        type: "paragraph",
        text: "Use for to repeat over a sequence, and while to repeat until a condition becomes false.",
      },
    ],
  },
  {
    materialId: "history-timeline",
    page: 1,
    blocks: [
      { type: "title", text: "History Timeline" },
      {
        type: "paragraph",
        text: "This file is still being embedded. You can read it now; answers will use it once it is ready.",
      },
    ],
  },
];

/** Document chats, keyed by material. */
export const mockDocumentThreads: DocumentThread[] = [
  {
    id: "explain-ch2",
    materialId: "biology-ch2-cells",
    materialIds: ["biology-ch2-cells", "physics-lecture-05"],
    messages: [
      { id: "m1", role: "user", text: "Explain chapter 2 simply" },
      {
        id: "m2",
        role: "assistant",
        content: [
          { text: "Chapter 2 is about the parts of a cell. The key idea is the " },
          { text: "cell membrane", bold: true },
          {
            text: ": a flexible double layer of fat-like molecules, with proteins floating in it, that decides what gets in or out.",
          },
        ],
        citations: [
          { id: "c1", materialId: "biology-ch2-cells", fileName: "Biology_Ch2_Cells.pdf", page: 3, highlightId: "bio-membrane" },
        ],
        showActions: true,
      },
      { id: "m3", role: "user", text: "What does it say about mitochondria?" },
      {
        id: "m4",
        role: "assistant",
        content: [
          {
            text: "I couldn’t find that in your selected materials. It may be in a later chapter.",
          },
        ],
        followUps: [
          { id: "f1", label: { en: "Upload material", km: "បង្ហោះឯកសារសិក្សា" }, icon: "upload" },
          { id: "f2", label: { en: "Use general knowledge", km: "ប្រើចំណេះដឹងទូទៅ" } },
        ],
      },
    ],
  },
  {
    id: "physics-5",
    materialId: "physics-lecture-05",
    materialIds: ["physics-lecture-05"],
    messages: [
      { id: "m1", role: "user", text: "Summarize physics lecture 5" },
      {
        id: "m2",
        role: "assistant",
        content: [
          { text: "Lecture 5 covers Newton’s three laws. The most important one is the " },
          { text: "second law", bold: true },
          { text: ": force equals mass times acceleration." },
        ],
        citations: [
          { id: "c1", materialId: "physics-lecture-05", fileName: "Physics_Lecture_05.pdf", page: 1, highlightId: "phys-second-law" },
        ],
        showActions: true,
      },
    ],
  },
  {
    id: "khmer-poems",
    materialId: "khmer-literature-notes",
    materialIds: ["khmer-literature-notes"],
    messages: [
      { id: "m1", role: "user", text: "Quiz me on Khmer poems" },
      {
        id: "m2",
        role: "assistant",
        content: [
          { text: "Question 1: How many syllables are in each line of the " },
          { text: "Bat Kakagati", bold: true },
          { text: " meter?" },
        ],
        citations: [
          { id: "c1", materialId: "khmer-literature-notes", fileName: "Khmer_Literature_Notes.docx", page: 1, highlightId: "khmer-meter" },
        ],
        showActions: true,
      },
    ],
  },
];
