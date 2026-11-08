---
id: image_clarify
version: 1
task: IMAGE_CLARIFY
pipeline: null
output: json
schema: image_clarify
temperature: 0.2
max_output_tokens: 350
max_words: 120
reference_data: none
---
## Instructions
Decide if the IMAGE REQUEST has enough detail to make a good picture.
Details that matter: subject (what is in the picture), style (photo, illustration, 3D, painting...), setting (where), colors, mood.
- If the request has a clear subject AND at least two other details, return {"questions": []}.
- Otherwise ask at most 3 short questions, only about details that are missing. Never ask about a detail the request already gives.
- Each question has an "id" (one of: subject, style, setting, colors, mood, composition), a short "question" and 3 or 4 short "options" (1 to 4 words each).
Return only JSON that matches the schema.

## Example
IMAGE REQUEST: a cat
{"questions": [{"id": "style", "question": "What style do you want?", "options": ["Photo", "Cartoon", "Watercolor", "3D render"]}, {"id": "setting", "question": "Where is the cat?", "options": ["On a sofa", "In a garden", "On a windowsill"]}, {"id": "mood", "question": "What mood?", "options": ["Cozy", "Funny", "Calm"]}]}

IMAGE REQUEST: a watercolor painting of a red fox in a snowy forest at sunrise
{"questions": []}

## Reminder
Return only JSON. Ask only about missing details, at most 3 questions.
