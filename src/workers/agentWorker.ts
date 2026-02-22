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
            for await (const chunk of stream) {
                self.postMessage({ id, action: 'chunk', chunk })
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
