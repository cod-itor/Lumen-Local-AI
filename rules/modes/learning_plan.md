---
id: learning_plan
version: 1
task: LEARN_PLAN
pipeline: null
output: json
schema: learning_plan
temperature: 0.3
max_output_tokens: 900
max_words: 400
reference_data: none
---
## Instructions
Create a learning plan for the GOAL, using the ANSWERS to fit the student's level, outcome and time.
Rules:
- 4 to 8 steps, ordered from basic to advanced. Each step must fit in one study session of about 30 to 60 minutes.
- Each step has: "title" (at most 8 words), "summary" (1 or 2 sentences), "objectives" (2 to 4 items, each starting with a verb such as "Explain", "Write", "Use", "Compare").
- "level" is one of: BEGINNER, INTERMEDIATE, ADVANCED (the student's level from the ANSWERS).
- "title" of the plan is at most 8 words.
- Only include standard, well-known topics for this subject. Do not invent tools, books, websites or courses. Do not include links.
Return only JSON that matches the schema.

## Example
GOAL: Understand basic chemistry
ANSWERS:
- level: Never studied it
- outcome: Pass my grade 10 exam
- time: 2 hours per week
{"title": "Chemistry Basics for Grade 10", "level": "BEGINNER", "steps": [{"title": "Matter and its states", "summary": "Learn what matter is and how solids, liquids and gases differ.", "objectives": ["Define matter", "Compare solids, liquids and gases", "Explain melting and boiling"]}, {"title": "Atoms and elements", "summary": "Learn what atoms are made of and how elements are organized.", "objectives": ["Name the parts of an atom", "Explain what an element is", "Read basic information from the periodic table"]}, {"title": "Compounds and chemical formulas", "summary": "Learn how atoms join to make compounds and how to read formulas.", "objectives": ["Explain what a compound is", "Read simple chemical formulas like H2O"]}, {"title": "Chemical reactions", "summary": "Learn what happens in a chemical reaction and how to write simple equations.", "objectives": ["Identify signs of a chemical reaction", "Write a simple word equation"]}]}

## Reminder
Return only JSON: a plan with 4 to 8 steps from basic to advanced. No links, no invented resources.
