import type { RoadmapMessages } from "../en/roadmap";

/** Khmer — "roadmap" strings. Must have exactly the same keys as en/roadmap.ts. */
export const roadmap: RoadmapMessages = {
  updated: "ផែនការ · ធ្វើបច្ចុប្បន្នភាព {date}",
  status: {
    done: "រួចរាល់",
    inProgress: "កំពុងធ្វើ",
    planned: "ក្នុងគម្រោង",
  },
  bigPicture: {
    eyebrow: "រូបភាពរួម",
    title: "បីផ្នែក ការសន្ទនាតែមួយ",
    subtitle: "មើលសារមួយធ្វើដំណើរ — ប្រអប់ដែលកំពុងធ្វើការនឹងភ្លឺឡើង។",
  },
  howItWorks: {
    eyebrow: "របៀបដំណើរការ",
    title: "ពីការដំឡើង ដល់ការបញ្ជាពីចម្ងាយ",
    firstRun: "ការបើកលើកដំបូងលើកុំព្យូទ័រ",
  },
  preview: {
    eyebrow: "អ្វីដែលអ្នកប្រើនឹងឃើញ",
    title: "អនឡាញ អហ្វឡាញ និងការរៀបចំ",
    subtitle: "គំរូនៃស្ថានភាពគេហទំព័រដែលបានគ្រោងទុក។ សម្រាប់បង្ហាញតែប៉ុណ្ណោះ។",
  },
  changes: {
    eyebrow: "អ្វីដែលផ្លាស់ប្តូរ",
    title: "បច្ចុប្បន្ន ធៀបនឹងផែនការ",
    area: "ផ្នែក",
    today: "បច្ចុប្បន្ន",
    planned: "ផែនការ",
    todayLabel: "បច្ចុប្បន្ន៖ ",
  },
  tech: {
    eyebrow: "បច្ចេកវិទ្យាដែលណែនាំ",
    title: "អ្វីដែលយើងនឹងប្រើដើម្បីបង្កើត",
    pairing: "ការផ្គូផ្គងឧបករណ៍",
  },
  tradeOffs: {
    eyebrow: "គុណ និងវិបត្តិ",
    title: "ត្រូវដឹងមុនពេលចាប់ផ្តើម",
  },
  buildOrder: {
    eyebrow: "លំដាប់នៃការបង្កើត",
    title: "ចេញផ្សាយជាជំហានតូចៗ",
    subtitle: "ចាប់ផ្តើមដោយការជជែកតាម relay សិន បន្ទាប់មកបន្ថែមឯកសារ និងរូបភាព។",
  },
  notes: {
    eyebrow: "កំណត់ចំណាំផែនការ",
    title: "ព័ត៌មានលម្អិតសម្រាប់សម្រេចពេលក្រោយ",
    subtitle: "បន្ថែមពេលកំពុងសរសេរផែនការនេះ — ជាការណែនាំ មិនមែនជាការសម្រេចចិត្តទេ។",
    tableBefore: "តារាង ",
    tableAfter: " (Postgres)",
    column: "ជួរឈរ",
    type: "ប្រភេទ",
    why: "មូលហេតុ",
    protocol: "សារ relay (សេចក្តីព្រាង)",
    security: "បញ្ជីពិនិត្យសុវត្ថិភាព",
    openQuestions: "សំណួរដែលនៅចំហ",
  },
  journey: {
    title: "របៀបដែលសារមួយធ្វើដំណើរ",
    subtitle: "ពីទូរស័ព្ទរបស់អ្នក ទៅកុំព្យូទ័រ ហើយត្រឡប់មកវិញ ក្នុងប្រាំមួយជំហាន។",
    play: "ចាក់",
    pause: "ផ្អាក",
    announce: "ជំហានទី {n}៖ {title}។ {detail}",
    actors: {
      website: "គេហទំព័រ",
      backend: "Backend",
      desktop: "កម្មវិធី Desktop",
    },
  },
  diagram: {
    label: "ស្ថាបត្យកម្ម៖ គេហទំព័រ backend លើ cloud និងកម្មវិធី Desktop",
  },
  devices: {
    settings: "ការកំណត់ → ឧបករណ៍",
    inChat: "ក្នុងការជជែក",
    laptopName: "MacBook របស់សុខា",
    laptopMeta: "Gemma 4 E2B រួចរាល់ · ទើបតែឃើញ",
    pcName: "កុំព្យូទ័រនៅផ្ទះ",
    pcMeta: "ឃើញចុងក្រោយ ២ ម៉ោងមុន",
    online: "អនឡាញ",
    offline: "អហ្វឡាញ",
    offlineTitle: "កុំព្យូទ័ររបស់អ្នកកំពុងអហ្វឡាញ",
    offlineBody: "បើក Lumen Desktop នៅលើ MacBook របស់សុខា ដើម្បីបន្តការជជែក។ ប្រវត្តិរបស់អ្នកនៅតែមាននៅទីនេះ។",
    setup: "ការរៀបចំ Desktop · កំពុងទាញយក Gemma 4 E2B",
    size: "2.1 / 3.2 GB",
  },
};
