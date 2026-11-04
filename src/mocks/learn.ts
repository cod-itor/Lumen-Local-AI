import type { LearningPath } from "@/types/learn";

/** "Python basics" path, in the Figma state: step 2 of 6, quiz question 2 answered. */
export const mockLearningPath: LearningPath = {
  id: "python-basics",
  title: "Python basics",
  progress: {
    currentStepIndex: 1,
    currentQuestionIndex: 1,
    selectedOptionId: "append",
  },
  steps: [
    {
      id: "variables",
      title: "Variables and types",
      intro: [
        { text: "A " },
        { text: "variable", bold: true },
        { text: " is a name that points to a value. Every value has a " },
        { text: "type", bold: true },
        { text: ", like a number or a piece of text." },
      ],
      code: {
        language: "python",
        lines: [
          [{ text: "name = " }, { text: '"Sokha"', kind: "string" }],
          [{ text: "age = 17" }],
          [
            { text: "print", kind: "builtin" },
            { text: "(" },
            { text: "type", kind: "builtin" },
            { text: "(age))" },
          ],
        ],
      },
      quiz: [
        {
          id: "v1",
          prompt: "What is the type of 3.5?",
          options: [
            { id: "int", label: "int" },
            { id: "float", label: "float" },
            { id: "str", label: "str" },
          ],
          correctOptionId: "float",
        },
        {
          id: "v2",
          prompt: "Which line stores text in a variable?",
          options: [
            { id: "a", label: "city = Phnom Penh" },
            { id: "b", label: 'city = "Phnom Penh"' },
            { id: "c", label: '"city" = Phnom Penh' },
          ],
          correctOptionId: "b",
        },
      ],
    },
    {
      id: "lists-loops",
      title: "Lists and loops",
      intro: [
        { text: "A " },
        { text: "list", bold: true },
        { text: " keeps several values in order. A " },
        { text: "for loop", bold: true },
        { text: " repeats the same code once for each item." },
      ],
      code: {
        language: "python",
        lines: [
          [
            { text: "fruits = [" },
            { text: '"mango"', kind: "string" },
            { text: ", " },
            { text: '"banana"', kind: "string" },
            { text: ", " },
            { text: '"durian"', kind: "string" },
            { text: "]" },
          ],
          [
            { text: "for ", kind: "keyword" },
            { text: "fruit" },
            { text: " in ", kind: "keyword" },
            { text: "fruits:" },
          ],
          [
            { text: "    " },
            { text: "print", kind: "builtin" },
            { text: "(" },
            { text: '"I like"', kind: "string" },
            { text: ", fruit)" },
          ],
        ],
      },
      quiz: [
        {
          id: "l1",
          prompt: "How many times does the loop above run?",
          options: [
            { id: "1", label: "1" },
            { id: "3", label: "3" },
            { id: "4", label: "4" },
          ],
          correctOptionId: "3",
        },
        {
          id: "l2",
          prompt: 'Which line adds "jackfruit" to the end of the list?',
          options: [
            { id: "add", label: 'fruits.add("jackfruit")' },
            { id: "append", label: 'fruits.append("jackfruit")' },
            { id: "plus", label: 'fruits + "jackfruit"' },
          ],
          correctOptionId: "append",
        },
        {
          id: "l3",
          prompt: "What does fruits[0] return?",
          options: [
            { id: "mango", label: '"mango"' },
            { id: "banana", label: '"banana"' },
            { id: "error", label: "IndexError" },
          ],
          correctOptionId: "mango",
        },
      ],
    },
    {
      id: "functions",
      title: "Functions",
      intro: [
        { text: "A " },
        { text: "function", bold: true },
        { text: " groups code under a name so you can reuse it. " },
        { text: "return", bold: true },
        { text: " sends a value back to the caller." },
      ],
      code: {
        language: "python",
        lines: [
          [{ text: "def ", kind: "keyword" }, { text: "greet(name):" }],
          [
            { text: "    " },
            { text: "return ", kind: "keyword" },
            { text: '"Hello, "', kind: "string" },
            { text: " + name" },
          ],
          [
            { text: "print", kind: "builtin" },
            { text: "(greet(" },
            { text: '"Dara"', kind: "string" },
            { text: "))" },
          ],
        ],
      },
      quiz: [
        {
          id: "f1",
          prompt: "Which keyword defines a function?",
          options: [
            { id: "func", label: "func" },
            { id: "def", label: "def" },
            { id: "fn", label: "fn" },
          ],
          correctOptionId: "def",
        },
        {
          id: "f2",
          prompt: 'What does greet("Dara") return?',
          options: [
            { id: "a", label: '"Hello, Dara"' },
            { id: "b", label: '"Dara"' },
            { id: "c", label: "None" },
          ],
          correctOptionId: "a",
        },
      ],
    },
    {
      id: "dictionaries",
      title: "Dictionaries",
      intro: [
        { text: "A " },
        { text: "dictionary", bold: true },
        { text: " maps " },
        { text: "keys", bold: true },
        { text: " to values, so you can look things up by name." },
      ],
      code: {
        language: "python",
        lines: [
          [
            { text: "prices = {" },
            { text: '"mango"', kind: "string" },
            { text: ": 2000, " },
            { text: '"durian"', kind: "string" },
            { text: ": 8000}" },
          ],
          [
            { text: "print", kind: "builtin" },
            { text: "(prices[" },
            { text: '"mango"', kind: "string" },
            { text: "])" },
          ],
        ],
      },
      quiz: [
        {
          id: "d1",
          prompt: 'How do you read the price of "durian"?',
          options: [
            { id: "a", label: 'prices("durian")' },
            { id: "b", label: 'prices["durian"]' },
            { id: "c", label: "prices.durian" },
          ],
          correctOptionId: "b",
        },
        {
          id: "d2",
          prompt: "Which method lists all keys?",
          options: [
            { id: "a", label: "prices.keys()" },
            { id: "b", label: "prices.all()" },
            { id: "c", label: "prices.names()" },
          ],
          correctOptionId: "a",
        },
      ],
    },
    {
      id: "files",
      title: "Reading files",
      intro: [
        { text: "Use " },
        { text: "open()", bold: true },
        { text: " inside a " },
        { text: "with", bold: true },
        { text: " block so the file closes automatically when you are done." },
      ],
      code: {
        language: "python",
        lines: [
          [
            { text: "with ", kind: "keyword" },
            { text: "open", kind: "builtin" },
            { text: "(" },
            { text: '"notes.txt"', kind: "string" },
            { text: ") " },
            { text: "as ", kind: "keyword" },
            { text: "f:" },
          ],
          [
            { text: "    " },
            { text: "for ", kind: "keyword" },
            { text: "line" },
            { text: " in ", kind: "keyword" },
            { text: "f:" },
          ],
          [{ text: "        " }, { text: "print", kind: "builtin" }, { text: "(line.strip())" }],
        ],
      },
      quiz: [
        {
          id: "r1",
          prompt: "Why use a with block?",
          options: [
            { id: "a", label: "It reads faster" },
            { id: "b", label: "It closes the file for you" },
            { id: "c", label: "It is required by Python" },
          ],
          correctOptionId: "b",
        },
        {
          id: "r2",
          prompt: "Which mode opens a file for reading?",
          options: [
            { id: "r", label: '"r"' },
            { id: "w", label: '"w"' },
            { id: "a", label: '"a"' },
          ],
          correctOptionId: "r",
        },
      ],
    },
    {
      id: "mini-project",
      title: "Mini project",
      intro: [
        { text: "Put it together: read a list of fruits from a file, count them with a " },
        { text: "dictionary", bold: true },
        { text: ", and print the most common one." },
      ],
      code: {
        language: "python",
        lines: [
          [{ text: "counts = {}" }],
          [
            { text: "for ", kind: "keyword" },
            { text: "fruit" },
            { text: " in ", kind: "keyword" },
            { text: "fruits:" },
          ],
          [
            { text: "    counts[fruit] = counts." },
            { text: "get", kind: "builtin" },
            { text: "(fruit, 0) + 1" },
          ],
          [
            { text: "print", kind: "builtin" },
            { text: "(" },
            { text: "max", kind: "builtin" },
            { text: "(counts, key=counts.get))" },
          ],
        ],
      },
      quiz: [
        {
          id: "m1",
          prompt: "What does counts.get(fruit, 0) return for a new fruit?",
          options: [
            { id: "none", label: "None" },
            { id: "zero", label: "0" },
            { id: "error", label: "KeyError" },
          ],
          correctOptionId: "zero",
        },
      ],
    },
  ],
};
