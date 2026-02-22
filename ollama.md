@beautifulMention create this ollama client that supports asyncronous connection.
means this file will handle multiple chat streams at the same time in my app. by the way ollama is installed in my system..

your job. create the functions that does this.

- async stream chat
- handle thinking 
- handle image upload
- function to generate structured outputs and return the response
- handle generate content (no stream generate conent at once.)

make the functions so flexible so that thy can take systemprompts , personality of the ai and the user prompt. with history.

Your job is just to create this file@beautifulMention  nothing else.

Here's the docs you might need as per latest ollama docs:


----------

# Stream a response
Stream a response for the provided prompt

```
import ollama from 'ollama'

async function main() {
  const stream = await ollama.chat({
    model: 'qwen3',
    messages: [{ role: 'user', content: 'What is 17 × 23?' }],
    stream: true,
  })

  let inThinking = false
  let content = ''
  let thinking = ''

  for await (const chunk of stream) {
    if (chunk.message.thinking) {
      if (!inThinking) {
        inThinking = true
        process.stdout.write('Thinking:\n')
      }
      process.stdout.write(chunk.message.thinking)
      // accumulate the partial thinking
      thinking += chunk.message.thinking
    } else if (chunk.message.content) {
      if (inThinking) {
        inThinking = false
        process.stdout.write('\n\nAnswer:\n')
      }
      process.stdout.write(chunk.message.content)
      // accumulate the partial content
      content += chunk.message.content
    }
  }

  // append the accumulated fields to the messages for the next request
  new_messages = [{ role: 'assistant', thinking: thinking, content: content }]
}

main().catch(console.error)
```

# Thinking:
Thinking mode of llm

```
import ollama from 'ollama'

async function main() {
  const stream = await ollama.chat({
    model: 'qwen3',
    messages: [{ role: 'user', content: 'What is 17 × 23?' }],
    think: true,
    stream: true,
  })

  let inThinking = false

  for await (const chunk of stream) {
    if (chunk.message.thinking && !inThinking) {
      inThinking = true
      process.stdout.write('Thinking:\n')
    }

    if (chunk.message.thinking) {
      process.stdout.write(chunk.message.thinking)
    } else if (chunk.message.content) {
      if (inThinking) {
        process.stdout.write('\n\nAnswer:\n')
        inThinking = false
      }
      process.stdout.write(chunk.message.content)
    }
  }
}

main()
```

# Structured outputs:

```
import ollama from 'ollama'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

const Country = z.object({
  name: z.string(),
  capital: z.string(),
  languages: z.array(z.string()),
})

const response = await ollama.chat({
  model: 'gpt-oss',
  messages: [{ role: 'user', content: 'Tell me about Canada.' }],
  format: zodToJsonSchema(Country),
})

const country = Country.parse(JSON.parse(response.message.content))
console.log(country)
```


# Vision

```
import ollama from 'ollama'

const imagePath = '/absolute/path/to/image.jpg'
const response = await ollama.chat({
  model: 'gemma3',
  messages: [
    { role: 'user', content: 'What is in this image?', images: [imagePath] }
  ],
  stream: false,
})

console.log(response.message.content)
```


# Embedding:

```
import ollama from 'ollama'

const batch = await ollama.embed({
  model: 'embeddinggemma',
  input: [
    'The quick brown fox jumps over the lazy dog.',
    'The five boxing wizards jump quickly.',
    'Jackdaws love my big sphinx of quartz.',
  ],
})
console.log(batch.embeddings.length) // number of vectors
```

# Tool calling:
```
import ollama from 'ollama'

type ToolName = 'add' | 'multiply'

function add(a: number, b: number): number {
  return a + b
}

function multiply(a: number, b: number): number {
  return a * b
}

const availableFunctions: Record<ToolName, (a: number, b: number) => number> = {
  add,
  multiply,
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'add',
      description: 'Add two numbers',
      parameters: {
        type: 'object',
        required: ['a', 'b'],
        properties: {
          a: { type: 'integer', description: 'The first number' },
          b: { type: 'integer', description: 'The second number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'multiply',
      description: 'Multiply two numbers',
      parameters: {
        type: 'object',
        required: ['a', 'b'],
        properties: {
          a: { type: 'integer', description: 'The first number' },
          b: { type: 'integer', description: 'The second number' },
        },
      },
    },
  },
]

async function agentLoop() {
  const messages = [{ role: 'user', content: 'What is (11434+12341)*412?' }]

  while (true) {
    const response = await ollama.chat({
      model: 'qwen3',
      messages,
      tools,
      think: true,
    })

    messages.push(response.message)
    console.log('Thinking:', response.message.thinking)
    console.log('Content:', response.message.content)

    const toolCalls = response.message.tool_calls ?? []
    if (toolCalls.length) {
      for (const call of toolCalls) {
        const fn = availableFunctions[call.function.name as ToolName]
        if (!fn) {
          continue
        }

        const args = call.function.arguments as { a: number; b: number }
        console.log(`Calling ${call.function.name} with arguments`, args)
        const result = fn(args.a, args.b)
        console.log(`Result: ${result}`)
        messages.push({ role: 'tool', tool_name: call.function.name, content: String(result) })
      }
    } else {
      break
    }
  }
}

agentLoop().catch(console.error)
```