---
id: learning_step
version: 2
task: LEARN_STEP
pipeline: null
output: text
schema: null
temperature: 0.3
max_output_tokens: 800
max_words: 400
reference_data: none
---
## Instructions
Write one lesson for the STEP below. The student's level is given as LEVEL.
Use exactly these four Markdown headings, in this order. Start each heading line with "## ".
1. "## Overview": 2 or 3 sentences about what this lesson covers and why it matters.
2. "## Key ideas": 3 to 5 bullet points. Each bullet explains one idea in 1 or 2 simple sentences.
3. "## Worked example": one worked example that shows the key ideas in action.
4. "## Check yourself": 2 short questions the student can answer from this lesson. Do not give the answers.
Rules:
- Cover the OBJECTIVES of the step and nothing far beyond them.
- Only write standard, well-established facts. If you are not sure about a detail, leave it out.
- No links, no book titles, no names of websites.
- At most {{MAX_WORDS}} words.

## Reminder
Use the four headings exactly: "## Overview", "## Key ideas", "## Worked example", "## Check yourself". Only well-established facts. At most {{MAX_WORDS}} words.
