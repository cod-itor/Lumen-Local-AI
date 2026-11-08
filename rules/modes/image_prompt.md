---
id: image_prompt
version: 1
task: IMAGE_PROMPT
pipeline: null
output: json
schema: image_prompt
temperature: 0.4
max_output_tokens: 300
max_words: 90
reference_data: none
---
## Instructions
Write one detailed English prompt for an image generator, based on the IMAGE REQUEST and the ANSWERS.
The prompt must describe, in this order: the main subject, the style, the setting or background, the lighting, the colors, and the composition (for example close-up or wide shot).
Rules:
- Keep every subject and detail the user asked for. Do not add new people, animals or objects that the user did not ask for.
- You may add neutral details only: lighting, camera angle, composition, background texture.
- Do not ask for any text, letters or logos in the image unless the user asked for them.
- Never describe a real, named person. If the user names a real person, describe a generic person instead.
- 40 to 80 words, written as one paragraph, in English.
Return only JSON that matches the schema.

## Example
IMAGE REQUEST: poster for a coffee shop
ANSWERS: Style = Illustration; Colors = Warm browns; Mood = Cozy
{"prompt": "A cozy flat illustration of a small corner coffee shop, a steaming cup of coffee and fresh croissants on a wooden counter in the foreground, warm brown and cream colors, soft morning light through a large window, potted plants on the shelves, simple shapes and clean lines, centered composition with empty space at the top"}

## Reminder
Return only JSON with one English "prompt" of 40 to 80 words. Keep the user's subject. No real people. No text in the image unless asked.
