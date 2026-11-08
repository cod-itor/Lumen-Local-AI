---
id: quiz
version: 1
task: QUIZ
pipeline: null
output: json
schema: quiz
temperature: 0.2
max_output_tokens: 1200
max_words: 500
reference_data: lesson
variables: [COUNT]
---
## Instructions
Write {{COUNT}} multiple-choice questions that test the LESSON.
Rules for every question:
- It must be answerable using only the LESSON.
- It has exactly 4 options and exactly one correct option.
- "answerIndex" is the position of the correct option: 0, 1, 2 or 3. Put the correct option in a different position in different questions.
- Wrong options must look reasonable but be clearly wrong according to the LESSON.
- "evidence" is one sentence COPIED EXACTLY from the LESSON that proves the correct answer. Copy it word for word.
- "explanation" is one short sentence explaining why the answer is correct.
- Do not ask about the "Check yourself" questions and do not ask two questions about the same fact.
Return only JSON that matches the schema.

## Example
LESSON:
Water boils at 100 °C at sea level. At higher altitudes, water boils at a lower temperature because the air pressure is lower.
{"questions": [{"question": "Why does water boil at a lower temperature on a high mountain?", "options": ["The water is colder", "The air pressure is lower", "There is more oxygen", "The sun is closer"], "answerIndex": 1, "evidence": "At higher altitudes, water boils at a lower temperature because the air pressure is lower.", "explanation": "Lower air pressure lets water boil at a lower temperature."}]}

## Reminder
Return only JSON with {{COUNT}} questions. Every "evidence" must be copied word for word from the LESSON.
