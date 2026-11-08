import type { SettingsMessages } from "../en/settings";

/** Khmer — "settings" strings. Must have exactly the same keys as en/settings.ts. */
export const settings: SettingsMessages = {
  title: "ការកំណត់",
  navAria: "ផ្នែកនៃការកំណត់",
  nav: {
    howItWorks: "របៀបដែល AI របស់ Lumen ដំណើរការ",
    models: "ម៉ូដែលតាមការងារ",
    installed: "ម៉ូដែលដែលបានដំឡើង",
    setup: "ការណែនាំដំឡើង",
    guardrails: "ច្បាប់ និងការការពារ",
    privacy: "អ្វីដែលចេញពីឧបករណ៍របស់អ្នក",
    language: "ភាសា",
    appearance: "រូបរាង",
    account: "គណនី",
  },
  models: {
    title: "ម៉ូដែលតាមការងារ",
    description:
      "Lumen ប្រើម៉ូដែលផ្សេងគ្នាសម្រាប់ការងារនីមួយៗ។ ជ្រើសរើសម៉ូដែលដែលអ្នកបានដំឡើង ឱ្យធ្វើការងារនីមួយៗ — ម៉ូដែលណាដែលសមស្រប នឹងបង្ហាញនៅទីនេះ។",
  },
  installed: {
    title: "ម៉ូដែលដែលបានដំឡើង",
    description: "អ្វីដែល Lumen រកឃើញនៅលើកុំព្យូទ័រនេះ។ លុបម៉ូដែលក្នុង Ollama ដើម្បីបង្កើនទំហំថាស។",
    roles: {
      chat: "ការរៀន និងជជែក",
      embedding: "ឯកសារ · embeddings",
      image: "រូបភាព",
    },
  },
  setup: {
    title: "ការណែនាំដំឡើង",
    description: "កុំព្យូទ័រថ្មី? គ្រាន់តែ ៥ ជំហាន Lumen ក៏រួចរាល់។",
  },
  guardrails: {
    title: "ច្បាប់ និងការការពារ",
    description:
      "មិនថាអ្នកដំឡើងម៉ូដែលណាទេ Lumen ដាក់ច្បាប់ដូចគ្នាជុំវិញវា។ នេះគឺជាអ្វីដែលម៉ូដែលនីមួយៗត្រូវបានប្រាប់ និងអនុញ្ញាតឱ្យធ្វើ។",
    appliesTo: "អនុវត្តចំពោះ៖ {target}",
  },
  privacy: {
    askBeforeSearch: "សួរមុនពេលស្វែងរកលើអ៊ីនធឺណិត",
    askBeforeSearchDetail: "បង្ហាញពាក្យស្វែងរកជាមុន ដើម្បីឱ្យអ្នកអាចកែ ឬបោះបង់ មុនពេលអ្វីៗត្រូវផ្ញើទៅអ៊ីនធឺណិត។",
    title: "អ្វីដែលចេញពីឧបករណ៍របស់អ្នក",
    description: "មុខងារនីមួយៗដំណើរការនៅឯណា និងអ្វីខ្លះ (បើមាន) ដែលទៅលើអ៊ីនធឺណិត។",
    feature: "មុខងារ",
    runsOn: "ដំណើរការលើ",
    leaves: "ចេញពីឧបករណ៍",
    comingSoon: "នឹងមកដល់ឆាប់ៗ៖ ប្រើម៉ូដែលលើកុំព្យូទ័រយួរដៃ ពីទូរសព្ទរបស់អ្នក —",
    comingSoonProduct: "Lumen Desktop & Remote Access",
  },
  language: {
    title: "ភាសា",
    label: "ភាសាកម្មវិធី",
  },
  appearance: {
    title: "រូបរាង",
    theme: "រចនាប័ទ្ម",
    themeHint: "ងងឹតជាលំនាំដើម។",
    dark: "ងងឹត",
    light: "ភ្លឺ",
    chatWidth: "ទទឹងការជជែក",
    chatWidthHint: "ទំហំទទឹងនៃការសន្ទនា",
    adjust: "កែតម្រូវ",
  },
  account: {
    title: "គណនី",
    logOut: "ចាកចេញ",
  },
  runtime: {
    connected: "បានភ្ជាប់ទៅ {name}",
    notFound: "រកមិនឃើញ {name}",
    details: "ដំណើរការលើកុំព្យូទ័រនេះ · {host} · v{version}",
    checking: "កំពុងពិនិត្យ…",
    checkAgain: "ពិនិត្យម្ដងទៀត",
  },
  state: {
    ready: "រួចរាល់",
    downloading: "កំពុងទាញយក",
    missing: "មិនទាន់ដំឡើង",
  },
  roles: {
    usedIn: "ប្រើក្នុង",
    fromChat: "ពី ការរៀន និងជជែក",
    slotFor: "{slot} សម្រាប់ {role}",
    chooseModel: "ជ្រើសរើសម៉ូដែល",
    noneInstalled: "មិនទាន់មានការដំឡើង",
    installedHere: "បានដំឡើងលើកុំព្យូទ័រនេះ",
    downloadingProgress: "កំពុងទាញយក · {progress}%",
    mustHave: "ម៉ូដែលត្រូវតែ",
    tools: "ឧបករណ៍ដែលវាអាចហៅ",
    pipeline: "របៀបឆ្លើយសំណួរ",
    install: "ដំឡើង",
    alternatives: "ម៉ូដែលផ្សេងទៀតដែលប្រើបាន",
  },
  copyCommand: "ចម្លងពាក្យបញ្ជា៖ {command}",
  chatWidth: {
    title: "ទទឹងការជជែក",
    description: "អូស ឬរុញ ដើម្បីប្ដូរទំហំការសន្ទនា។ វាប្ដូរភ្លាមៗនៅខាងក្រោយផ្ទាំងនេះ។",
    width: "ទទឹង",
    presets: {
      narrow: "តូច",
      default: "លំនាំដើម",
      wide: "ធំ",
      full: "ពេញ",
    },
  },
};
