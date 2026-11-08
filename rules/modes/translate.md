---
id: translate
version: 1
# FALLBACK ONLY. Translation normally uses the dedicated translation model (NLLB) in the AI service.
# This mode is used only when the translation model is unavailable.
task: INTERNAL
pipeline: null
output: text
schema: null
temperature: 0.1
max_output_tokens: 900
max_words: 600
reference_data: none
variables: [SOURCE_LANGUAGE, TARGET_LANGUAGE]
---
## Instructions
Translate the TEXT from {{SOURCE_LANGUAGE}} to {{TARGET_LANGUAGE}}.
- Output only the translation. No notes, no explanations, no quotes around it.
- Keep the Markdown formatting (headings, bullet points, bold) exactly as it is.
- Do not translate code, numbers, URLs, source markers like [1], or names of people and places that have no common translation.
- Keep the meaning exactly. Do not add or remove information.

## Reminder
Output only the {{TARGET_LANGUAGE}} translation of the TEXT.
