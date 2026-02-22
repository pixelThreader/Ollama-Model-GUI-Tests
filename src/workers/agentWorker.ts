// ─────────────────────────────────────────────────────────────
//  Agent Worker — raw fetch streaming, zero SDK overhead
//  Each worker instance handles ONE session for true parallelism.
//  Uses direct fetch() + ReadableStream — no Ollama SDK,
//  no shared state, no queues.
// ─────────────────────────────────────────────────────────────

const OLLAMA_BASE = 'http://localhost:11434'

interface ChatPayload {
    model: string
    prompt: string
    systemPrompt?: string
    personality?: string
    history?: { role: string; content: string; images?: string[] }[]
    images?: string[]
    options?: Record<string, unknown>
    format?: string | Record<string, unknown>
}

interface WorkerMessage {
    id: string
    action: 'start' | 'abort'
    payload?: ChatPayload
}

// One AbortController per session-id so abort is instant
const controllers = new Map<string, AbortController>()

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { id, action, payload } = e.data

    if (action === 'abort') {
        const ctrl = controllers.get(id)
        if (ctrl) {
            ctrl.abort()
            controllers.delete(id)
        }
        return
    }

    if (action === 'start' && payload) {
        // Fire-and-forget — the async function runs independently,
        // it does NOT block the worker's message handler from
        // processing subsequent messages (e.g. abort).
        startStream(id, payload)
    }
}

async function startStream(id: string, payload: ChatPayload) {
    // Abort any prior stream for this session
    const prev = controllers.get(id)
    if (prev) prev.abort()

    const controller = new AbortController()
    controllers.set(id, controller)

    try {
        // Build the messages array
        const messages: { role: string; content: string; images?: string[] }[] = []

        if (payload.systemPrompt) {
            messages.push({ role: 'system', content: payload.systemPrompt })
        }
        if (payload.personality) {
            messages.push({ role: 'system', content: payload.personality })
        }
        if (payload.history?.length) {
            messages.push(...payload.history)
        }

        const userMsg: { role: string; content: string; images?: string[] } = {
            role: 'user',
            content: payload.prompt,
        }
        if (payload.images?.length) {
            userMsg.images = payload.images
        }
        messages.push(userMsg)

        // Build request body
        const body: Record<string, unknown> = {
            model: payload.model,
            messages,
            stream: true,
            keep_alive: -1,
        }
        if (payload.format) body.format = payload.format
        if (payload.options) body.options = payload.options

        // Direct raw fetch — no SDK, no middleware, pure parallel
        const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        })

        if (!response.ok) {
            const errText = await response.text().catch(() => response.statusText)
            throw new Error(`Ollama ${response.status}: ${errText}`)
        }

        if (!response.body) {
            throw new Error('Response body is missing')
        }

        // Stream the response using ReadableStream
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        let finalContent = ''
        let finalThinking = ''
        let lastPostTime = 0

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Parse NDJSON lines
            const parts = buffer.split('\n')
            buffer = parts.pop() ?? ''

            for (const part of parts) {
                if (!part.trim()) continue
                try {
                    const chunk = JSON.parse(part)

                    // Accumulate content
                    if (chunk.message?.content) {
                        finalContent += chunk.message.content
                    }
                    if (chunk.message?.thinking) {
                        finalThinking += chunk.message.thinking
                    }

                    // Throttle UI updates for non-done chunks (every 50ms)
                    // The UI-side uses requestAnimationFrame for smooth rendering,
                    // so we can be slightly less aggressive here to reduce postMessage overhead.
                    const now = Date.now()
                    if (chunk.done) {
                        self.postMessage({
                            id,
                            action: 'chunk',
                            chunk: {
                                content: finalContent,
                                thinking: finalThinking,
                                done: true,
                                totalDuration: chunk.total_duration ?? 0,
                                loadDuration: chunk.load_duration ?? 0,
                                promptEvalCount: chunk.prompt_eval_count ?? 0,
                                promptEvalDuration: chunk.prompt_eval_duration ?? 0,
                                evalCount: chunk.eval_count ?? 0,
                                evalDuration: chunk.eval_duration ?? 0,
                            },
                        })
                    } else if (now - lastPostTime > 100) {
                        lastPostTime = now
                        self.postMessage({
                            id,
                            action: 'chunk',
                            chunk: {
                                content: finalContent,
                                thinking: finalThinking,
                                done: false,
                            },
                        })
                    }
                } catch {
                    // skip malformed JSON lines
                }
            }
        }

        // Flush any remaining buffer
        if (buffer.trim()) {
            try {
                const chunk = JSON.parse(buffer)
                if (chunk.message?.content) finalContent += chunk.message.content
                if (chunk.message?.thinking) finalThinking += chunk.message.thinking
                self.postMessage({
                    id,
                    action: 'chunk',
                    chunk: {
                        content: finalContent,
                        thinking: finalThinking,
                        done: chunk.done ?? true,
                        totalDuration: chunk.total_duration ?? 0,
                        loadDuration: chunk.load_duration ?? 0,
                        promptEvalCount: chunk.prompt_eval_count ?? 0,
                        promptEvalDuration: chunk.prompt_eval_duration ?? 0,
                        evalCount: chunk.eval_count ?? 0,
                        evalDuration: chunk.eval_duration ?? 0,
                    },
                })
            } catch {
                // ignore
            }
        }

        self.postMessage({ id, action: 'done' })
    } catch (err: unknown) {
        const error = err as Error
        if (error.name === 'AbortError') {
            self.postMessage({ id, action: 'abort_success' })
        } else {
            self.postMessage({ id, action: 'error', error: error.message })
        }
    } finally {
        controllers.delete(id)
    }
}
