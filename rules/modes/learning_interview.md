---
id: learning_interview
version: 1
task: LEARN_QUESTION
pipeline: null
output: json
schema: learning_question
temperature: 0.3
max_output_tokens: 250
max_words: 60
reference_data: none
---
## Instructions
You help a student plan what to learn. You are given their GOAL and the ANSWERS SO FAR.
Ask the ONE most useful next question for planning their learning.
Check these topics in this order and ask about the first one that is not answered yet:
1. level: their current level in this subject
2. outcome: what they want to be able to do at the end
3. time: how much time they can study per week
4. focus: specific topics they care about most
5. style: how they like to learn (reading, examples, practice exercises)
Rules:
- Never ask about a topic that is already answered.
- If level, outcome and time are all answered, return {"done": true, "topic": "none", "question": "", "options": []}.
- Otherwise return {"done": false, "topic": "<topic>", "question": "<one short question>", "options": [2 to 4 short answers the student can tap]}.
- The question must be under 20 words.
Return only JSON that matches the schema.

## Example
GOAL: I want to learn Python
ANSWERS SO FAR: (none)
{"done": false, "topic": "level", "question": "Have you programmed before?", "options": ["Never", "A little", "Yes, in another language"]}

GOAL: I want to learn Python
ANSWERS SO FAR:
- level: Never
- outcome: Build small programs for school
- time: 3 hours per week
{"done": true, "topic": "none", "question": "", "options": []}

## Reminder
Return only JSON. Ask about the first unanswered topic in the list, or return done = true if level, outcome and time are answered.
