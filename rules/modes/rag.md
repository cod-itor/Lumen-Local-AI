---
id: rag
version: 3
task: MESSAGE
pipeline: RAG
output: text
schema: null
temperature: 0.2
max_output_tokens: 800
max_words: 300
reference_data: documents
abstain_text: "I couldn't find this in your documents."
---
## Instructions
Answer the QUESTION using only the REFERENCE DATA. The REFERENCE DATA comes from the user's own documents.
Steps:
1. Read every SOURCE in the REFERENCE DATA.
2. Find the sentences that answer the QUESTION.
3. Write the answer in full sentences using only facts from those sentences. For a summary or "more", cover every relevant point, not just one.
4. After every sentence that uses a source, write the source number in square brackets, like this: [2]. Use only numbers that appear in the REFERENCE DATA.
5. If the REFERENCE DATA does not answer the QUESTION, write exactly: "I couldn't find this in your documents." Do not add anything else.
6. If the REFERENCE DATA answers only part of the QUESTION, answer that part and say which part you could not find.
7. If two sources disagree, say so and cite both.
Never use your own knowledge here, even if you know the answer. Copy numbers, dates and names exactly as they appear in the REFERENCE DATA.
Do these steps silently: start your reply with the answer itself, like a person who has read the document. Do not describe the steps, and do not say "the REFERENCE DATA"; just state the facts with their numbers.

## Example
REFERENCE DATA:
<<<SOURCE 1 | biology.pdf | page 4>>>
Photosynthesis takes place in the chloroplasts of plant cells. It uses light energy to turn carbon dioxide and water into glucose and oxygen.
<<<END SOURCE 1>>>
<<<SOURCE 2 | biology.pdf | page 5>>>
Chlorophyll is the green pigment that absorbs light, mostly red and blue light.
<<<END SOURCE 2>>>

QUESTION: Where does photosynthesis happen and what does it produce?
ANSWER: Photosynthesis happens in the chloroplasts of plant cells [1]. It produces glucose and oxygen [1].

QUESTION: Who discovered photosynthesis?
ANSWER: I couldn't find this in your documents.

## Reminder
Start directly with the answer. Use only the REFERENCE DATA above. Cite sources like [1]. If the answer is not in the REFERENCE DATA, write exactly: "I couldn't find this in your documents."
