// ─────────────────────────────────────────────────────────────
//  Ollama Client — async, concurrent-safe, streaming-first
//  Talks directly to the local Ollama REST API (localhost:11434)
// ─────────────────────────────────────────────────────────────

const OLLAMA_BASE = 'http://localhost:11434'

// ── Types ────────────────────────────────────────────────────

export type Role = 'system' | 'user' | 'assistant'

export interface ChatMessage {
    role: Role
    content: string
    /** base64-encoded images for vision models */
    images?: string[]
    /** model's chain-of-thought (populated on assistant messages) */
    thinking?: string
}

export interface ChatOptions {
    model: string
    /** The user's current message */
    prompt: string
    /** System-level instruction (persona / rules) */
    systemPrompt?: string
    /** Extra personality prefix injected as a second system message */
    personality?: string
    /** Full conversation history (oldest → newest) */
    history?: ChatMessage[]
    /** base64-encoded images to attach to this turn */
    images?: string[]
    /** Model-level options (temperature, top_p, num_ctx …) */
    options?: Record<string, unknown>
    /** AbortSignal so the caller can cancel mid-stream */
    signal?: AbortSignal
}

export interface GenerateOptions {
    model: string
    prompt: string
    systemPrompt?: string
    images?: string[]
    options?: Record<string, unknown>
    signal?: AbortSignal
}

export interface StructuredOutputOptions<T = unknown> {
    model: string
    prompt: string
    systemPrompt?: string
    /** JSON Schema describing the shape you want back */
    format: Record<string, unknown>
    history?: ChatMessage[]
    images?: string[]
    options?: Record<string, unknown>
    signal?: AbortSignal
    /** Optional parser / validator — defaults to JSON.parse */
    parse?: (raw: string) => T
}

/** Fired on every streaming chunk */
export interface StreamChunk {
    content: string
    thinking: string
    done: boolean
}

/** Stats returned when the stream finishes (done === true) */
export interface StreamDoneStats {
    totalDuration: number
    loadDuration: number
    promptEvalCount: number
    promptEvalDuration: number
    evalCount: number
    evalDuration: number
}

/** Full response from a non-streaming /api/generate call */
export interface GenerateResponse {
    model: string
    response: string
    thinking: string
    done: boolean
    totalDuration: number
    loadDuration: number
    promptEvalCount: number
    promptEvalDuration: number
    evalCount: number
    evalDuration: number
}

export interface OllamaModel {
    name: string
    model: string
    modified_at: string
    size: number
    digest: string
    details: {
        format: string
        family: string
        families: string[]
        parameter_size: string
        quantization_level: string
    }
}

export interface RunningModel {
    name: string
    model: string
    size: number
    digest: string
    details: {
        parent_model: string
        format: string
        family: string
        families: string[]
        parameter_size: string
        quantization_level: string
    }
    expires_at: string
    size_vram: number
}

export interface ModelDetails {
    parameters: string
    license: string
    capabilities: string[]
    modified_at: string
    details: {
        parent_model: string
        format: string
        family: string
        families: string[]
        parameter_size: string
        quantization_level: string
    }
    model_info: Record<string, unknown>
}

export interface EmbedResponse {
    model: string
    embeddings: number[][]
    total_duration: number
    load_duration: number
    prompt_eval_count: number
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Build the messages array for /api/chat from ChatOptions.
 * Order: system → personality → history → current user message.
 */
function buildMessages(opts: ChatOptions): ChatMessage[] {
    const msgs: ChatMessage[] = []

    if (opts.systemPrompt) {
        msgs.push({ role: 'system', content: opts.systemPrompt })
    }
    if (opts.personality) {
        msgs.push({ role: 'system', content: opts.personality })
    }
    if (opts.history?.length) {
        msgs.push(...opts.history)
    }

    const userMsg: ChatMessage = { role: 'user', content: opts.prompt }
    if (opts.images?.length) {
        userMsg.images = opts.images
    }
    msgs.push(userMsg)

    return msgs
}

/**
 * Read an NDJSON (newline-delimited JSON) stream and yield parsed objects.
 * Works with any ReadableStream<Uint8Array> — fully async.
 */
async function* readNDJSON<T = unknown>(
    stream: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            // Keep the last (potentially incomplete) chunk in the buffer
            buffer = lines.pop() ?? ''

            for (const line of lines) {
                const trimmed = line.trim()
                if (trimmed.length === 0) continue
                yield JSON.parse(trimmed) as T
            }
        }

        // Flush any remaining data
        const remaining = buffer.trim()
        if (remaining.length > 0) {
            yield JSON.parse(remaining) as T
        }
    } finally {
        reader.releaseLock()
    }
}

/**
 * Convert a File / Blob to a base64 string (no data-uri prefix).
 * Useful for image uploads before passing to chat/generate.
 */
export function fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            // strip "data:image/png;base64," prefix
            resolve(result.split(',')[1] ?? result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

// ── Core API ─────────────────────────────────────────────────

/**
 * **Streaming chat** — yields `StreamChunk` objects as tokens arrive.
 *
 * Supports concurrent calls (each invocation gets its own fetch/stream).
 * Handles thinking tokens separately from content tokens.
 *
 * ```ts
 * for await (const chunk of streamChat({ model: 'gemma3', prompt: 'Hi' })) {
 *   process.stdout.write(chunk.content)
 * }
 * ```
 */
export async function* streamChat(
    opts: ChatOptions,
): AsyncGenerator<StreamChunk & Partial<StreamDoneStats>> {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: opts.model,
            messages: buildMessages(opts),
            stream: true,
            ...(opts.options ? { options: opts.options } : {}),
        }),
        signal: opts.signal,
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Ollama /api/chat failed (${res.status}): ${text}`)
    }

    if (!res.body) throw new Error('Response body is null')

    for await (const raw of readNDJSON<Record<string, unknown>>(res.body)) {
        const msg = (raw.message ?? {}) as Record<string, unknown>

        const chunk: StreamChunk & Partial<StreamDoneStats> = {
            content: (msg.content as string) ?? '',
            thinking: (msg.thinking as string) ?? '',
            done: (raw.done as boolean) ?? false,
        }

        // When done, attach perf stats
        if (chunk.done) {
            chunk.totalDuration = raw.total_duration as number
            chunk.loadDuration = raw.load_duration as number
            chunk.promptEvalCount = raw.prompt_eval_count as number
            chunk.promptEvalDuration = raw.prompt_eval_duration as number
            chunk.evalCount = raw.eval_count as number
            chunk.evalDuration = raw.eval_duration as number
        }

        yield chunk
    }
}

/**
 * **Non-streaming generate** — sends a prompt and returns the full response at once.
 *
 * Uses `/api/generate` with `stream: false`.
 * Supports system prompts and image attachments.
 */
export async function generate(
    opts: GenerateOptions,
): Promise<GenerateResponse> {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: opts.model,
            prompt: opts.prompt,
            stream: false,
            ...(opts.systemPrompt ? { system: opts.systemPrompt } : {}),
            ...(opts.images?.length ? { images: opts.images } : {}),
            ...(opts.options ? { options: opts.options } : {}),
        }),
        signal: opts.signal,
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Ollama /api/generate failed (${res.status}): ${text}`)
    }

    const data = await res.json()

    return {
        model: data.model,
        response: data.response ?? '',
        thinking: data.thinking ?? '',
        done: data.done,
        totalDuration: data.total_duration ?? 0,
        loadDuration: data.load_duration ?? 0,
        promptEvalCount: data.prompt_eval_count ?? 0,
        promptEvalDuration: data.prompt_eval_duration ?? 0,
        evalCount: data.eval_count ?? 0,
        evalDuration: data.eval_duration ?? 0,
    }
}

/**
 * **Structured output** — forces the model to respond in a given JSON schema,
 * then parses the response and returns a typed object.
 *
 * Uses `/api/chat` with `format` (Ollama's structured output feature) and `stream: false`.
 *
 * ```ts
 * const result = await generateStructured({
 *   model: 'gemma3',
 *   prompt: 'List 3 colors',
 *   format: {
 *     type: 'object',
 *     properties: { colors: { type: 'array', items: { type: 'string' } } },
 *     required: ['colors'],
 *   },
 * })
 * console.log(result.colors) // ['red', 'green', 'blue']
 * ```
 */
export async function generateStructured<T = unknown>(
    opts: StructuredOutputOptions<T>,
): Promise<T> {
    const messages: ChatMessage[] = []

    if (opts.systemPrompt) {
        messages.push({ role: 'system', content: opts.systemPrompt })
    }
    if (opts.history?.length) {
        messages.push(...opts.history)
    }

    const userMsg: ChatMessage = { role: 'user', content: opts.prompt }
    if (opts.images?.length) {
        userMsg.images = opts.images
    }
    messages.push(userMsg)

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: opts.model,
            messages,
            stream: false,
            format: opts.format,
            ...(opts.options ? { options: opts.options } : {}),
        }),
        signal: opts.signal,
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(
            `Ollama /api/chat (structured) failed (${res.status}): ${text}`,
        )
    }

    const data = await res.json()
    const raw: string = data.message?.content ?? ''
    const parse = opts.parse ?? ((s: string) => JSON.parse(s) as T)

    return parse(raw)
}

// ── Utility endpoints ────────────────────────────────────────

/** Fetch all locally available models. */
export async function listModels(
    signal?: AbortSignal,
): Promise<OllamaModel[]> {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal })
    if (!res.ok) throw new Error(`Failed to list models (${res.status})`)
    const data = await res.json()
    return data.models ?? []
}

/** Fetch currently running (loaded in RAM/VRAM) models. */
export async function listRunningModels(
    signal?: AbortSignal,
): Promise<RunningModel[]> {
    const res = await fetch(`${OLLAMA_BASE}/api/ps`, { signal })
    if (!res.ok) throw new Error(`Failed to list running models (${res.status})`)
    const data = await res.json()
    return data.models ?? []
}

/** Unload a model from memory. */
export async function unloadModel(
    model: string,
    signal?: AbortSignal,
): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: 0 }),
        signal,
    })
    if (!res.ok) throw new Error(`Failed to unload model (${res.status})`)
}

/** Fetch detailed info about a specific model. */
export async function showModel(
    model: string,
    signal?: AbortSignal,
): Promise<ModelDetails> {
    const res = await fetch(`${OLLAMA_BASE}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
        signal,
    })
    if (!res.ok) throw new Error(`Failed to show model (${res.status})`)
    return res.json()
}

/** Generate vector embeddings for a piece of text. */
export async function embed(
    model: string,
    input: string | string[],
    signal?: AbortSignal,
): Promise<EmbedResponse> {
    const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input }),
        signal,
    })
    if (!res.ok) throw new Error(`Failed to create embeddings (${res.status})`)
    return res.json()
}

/** Get the Ollama server version string. */
export async function getVersion(signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${OLLAMA_BASE}/api/version`, { signal })
    if (!res.ok) throw new Error(`Failed to get version (${res.status})`)
    const data = await res.json()
    return data.version
}

/** Quick health-check: returns true if the Ollama server is reachable. */
export async function isServerRunning(): Promise<boolean> {
    try {
        await getVersion()
        return true
    } catch {
        return false
    }
}
