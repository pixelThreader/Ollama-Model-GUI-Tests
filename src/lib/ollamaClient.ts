// ─────────────────────────────────────────────────────────────
//  Ollama Client — async, concurrent-safe, streaming-first
//  Talks directly using the official Ollama SDK
// ─────────────────────────────────────────────────────────────
import { Ollama } from 'ollama/browser'

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
    /** Enforce JSON or JSON schema structured output */
    format?: 'json' | Record<string, unknown>
    /** AbortSignal so the caller can cancel mid-stream */
    signal?: AbortSignal
}

export interface GenerateOptions {
    model: string
    prompt: string
    systemPrompt?: string
    images?: string[]
    options?: Record<string, unknown>
    format?: 'json' | Record<string, unknown>
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
    modelfile: string
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
 * Helper to build an Ollama client that attaches the given AbortSignal.
 */
function getClient(signal?: AbortSignal): Ollama {
    return new Ollama({
        host: OLLAMA_BASE,
        fetch: (url, init) => fetch(url, { ...init, signal })
    })
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
    const client = getClient(opts.signal)

    // Mapping format for SDK usage 
    const isStructured = opts.format && typeof opts.format === 'object'

    const stream = await client.chat({
        model: opts.model,
        messages: buildMessages(opts),
        stream: true,
        keep_alive: -1,
        ...(opts.format ? { format: isStructured ? (opts.format as Record<string, unknown>) : opts.format } : {}),
        ...(opts.options ? { options: opts.options } : {}),
    })

    for await (const chunk of stream) {
        const out: StreamChunk & Partial<StreamDoneStats> = {
            content: chunk.message?.content ?? '',
            thinking: chunk.message?.thinking ?? '',
            done: chunk.done ?? false,
        }

        if (chunk.done) {
            out.totalDuration = chunk.total_duration
            out.loadDuration = chunk.load_duration
            out.promptEvalCount = chunk.prompt_eval_count
            out.promptEvalDuration = chunk.prompt_eval_duration
            out.evalCount = chunk.eval_count
            out.evalDuration = chunk.eval_duration
        }

        yield out
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
    const client = getClient(opts.signal)

    const res = await client.generate({
        model: opts.model,
        prompt: opts.prompt,
        stream: false,
        ...(opts.systemPrompt ? { system: opts.systemPrompt } : {}),
        ...(opts.images?.length ? { images: opts.images } : {}),
        ...(opts.options ? { options: opts.options } : {}),
        ...(opts.format ? { format: opts.format as Record<string, unknown> | string } : {}),
    })

    return {
        model: res.model,
        response: res.response ?? '',
        thinking: res.thinking ?? '',
        done: res.done ?? true,
        totalDuration: res.total_duration ?? 0,
        loadDuration: res.load_duration ?? 0,
        promptEvalCount: res.prompt_eval_count ?? 0,
        promptEvalDuration: res.prompt_eval_duration ?? 0,
        evalCount: res.eval_count ?? 0,
        evalDuration: res.eval_duration ?? 0,
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
    const client = getClient(opts.signal)
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

    const res = await client.chat({
        model: opts.model,
        messages,
        stream: false,
        format: opts.format as Record<string, unknown> | string,
        ...(opts.options ? { options: opts.options } : {}),
    })

    const raw: string = res.message?.content ?? ''
    const parse = opts.parse ?? ((s: string) => JSON.parse(s) as T)

    return parse(raw)
}

// ── Utility endpoints ────────────────────────────────────────

/** Fetch all locally available models. */
export async function listModels(
    signal?: AbortSignal,
): Promise<OllamaModel[]> {
    const client = getClient(signal)
    const res = await client.list()
    return (res.models ?? []) as unknown as OllamaModel[]
}

/** Fetch currently running (loaded in RAM/VRAM) models. */
export async function listRunningModels(
    signal?: AbortSignal,
): Promise<RunningModel[]> {
    const client = getClient(signal)
    const res = await client.ps()
    return (res.models ?? []) as unknown as RunningModel[]
}

/** Unload a model from memory. */
export async function unloadModel(
    model: string,
    signal?: AbortSignal,
): Promise<void> {
    const client = getClient(signal)
    await client.generate({ model, prompt: '', keep_alive: 0 })
}

/** Fetch detailed info about a specific model. */
export async function showModel(
    model: string,
    signal?: AbortSignal,
): Promise<ModelDetails> {
    const client = getClient(signal)
    const res = await client.show({ model })
    return res as unknown as ModelDetails
}

/** Generate vector embeddings for a piece of text. */
export async function embed(
    model: string,
    input: string | string[],
    signal?: AbortSignal,
): Promise<EmbedResponse> {
    const client = getClient(signal)
    const res = await client.embed({ model, input })
    return res as unknown as EmbedResponse
}

/** Get the Ollama server version string. */
export async function getVersion(signal?: AbortSignal): Promise<string> {
    const client = getClient(signal)
    const res = await client.version()
    return res.version
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
