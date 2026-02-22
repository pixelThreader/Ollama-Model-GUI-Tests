import { streamChat, type ChatOptions } from '../lib/ollamaClient'

const controllers = new Map<string, AbortController>()

self.onmessage = async (e: MessageEvent) => {
    const { id, action, payload } = e.data

    if (action === 'abort') {
        controllers.get(id)?.abort()
        controllers.delete(id)
        return
    }

    if (action === 'start') {
        const controller = new AbortController()
        controllers.set(id, controller)

        try {
            const opts = payload as ChatOptions
            opts.signal = controller.signal

            const stream = streamChat(opts)

            let finalContent = ''
            let finalThinking = ''
            let lastUpdate = Date.now()

            for await (const chunk of stream) {
                finalContent += chunk.content
                if (chunk.thinking) finalThinking += chunk.thinking

                const now = Date.now()
                if (now - lastUpdate > 50 || chunk.done) {
                    lastUpdate = now
                    self.postMessage({
                        id,
                        action: 'chunk',
                        chunk: { ...chunk, content: finalContent, thinking: finalThinking }
                    })
                }
            }
            self.postMessage({ id, action: 'done' })
        } catch (err: unknown) {
            const error = err as Error
            if (error.name !== 'AbortError') {
                self.postMessage({ id, action: 'error', error: error.message })
            } else {
                self.postMessage({ id, action: 'abort_success' })
            }
        } finally {
            controllers.delete(id)
        }
    }
}
