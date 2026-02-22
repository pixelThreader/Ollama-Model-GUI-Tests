import { useRef, useEffect, useCallback, useState, memo } from 'react'
import {
    Message,
    MessageContent,
    MessageResponse,
} from '@/components/ai-elements/message'
import {
    Reasoning,
    ReasoningTrigger,
    ReasoningContent,
} from '@/components/ai-elements/reasoning'
import {
    PromptInput,
    PromptInputProvider,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputFooter,
    PromptInputTools,
    PromptInputSubmit,
    usePromptInputController,
    PromptInputHeader,
    PromptInputButton,
} from '@/components/ai-elements/prompt-input'
import {
    Attachments,
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
} from '@/components/ai-elements/attachments'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'
import { showModel } from '@/lib/ollamaClient'
import type { StreamDoneStats, OllamaModel } from '@/lib/ollamaClient'
import AgentWorker from '@/workers/agentWorker?worker'
import { SYSTEM_PROMPTS, PERSONALITIES, systemPromptList, personalityList } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { XIcon, Trash2Icon, PlayIcon, TimerIcon, ImageIcon } from 'lucide-react'
import { generateRandomPrompt } from '@/lib/dummy'

export type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    thinking?: string
    isStreaming?: boolean
    images?: string[]
}

/** Config-only shape that the parent manages (no streaming data) */
export type SessionConfig = {
    id: string
    model: string
    systemPromptId: string
    personalityId: string
    mode: 'stream' | 'generate' | 'structured'
    initialPrompt?: string
}

/** Full session state — kept internally by each SessionCard */
export type SessionState = SessionConfig & {
    messages: ChatMessage[]
    stats?: StreamDoneStats
    isGenerating: boolean
}

interface SessionCardProps {
    config: SessionConfig
    models: OllamaModel[]
    onUpdateConfig: (id: string, updates: Partial<SessionConfig>) => void
    onRemove: (id: string) => void
    onInputUpdate: (id: string, hasValue: boolean) => void
    /** Signals that bubble status up for global metrics */
    onStreamingStatus?: (id: string, isGenerating: boolean, stats?: StreamDoneStats) => void
    bulkSendSignal: number
    fillRandomSignal: number
}

// Helper components outside the main component for performance and clarity
function AttachmentList() {
    const { attachments } = usePromptInputController()
    if (attachments.files.length === 0) return null

    return (
        <Attachments variant="grid" className="mb-2 flex w-full flex-wrap gap-2 px-3 pt-3">
            {attachments.files.map((file) => (
                <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
                    <AttachmentPreview />
                    <AttachmentRemove />
                </Attachment>
            ))}
        </Attachments>
    )
}

function ImagePickerButton({ disabled }: { disabled?: boolean }) {
    const { attachments } = usePromptInputController()
    return (
        <PromptInputButton
            disabled={disabled}
            onClick={() => attachments.openFileDialog()}
            tooltip="Upload images"
        >
            <ImageIcon className="h-4 w-4" />
        </PromptInputButton>
    )
}

function BulkReceiver({ signal, onSend }: { signal: number, onSend: (msg: PromptInputMessage) => void }) {
    const controller = usePromptInputController()
    const lastProcessedSignal = useRef(0)

    useEffect(() => {
        if (signal > lastProcessedSignal.current) {
            lastProcessedSignal.current = signal
            const text = controller.textInput.value.trim()
            if (text) {
                const files = [...controller.attachments.files]

                // Convert blob URLs to data URLs asynchronously
                const processBatch = async () => {
                    const convertedFiles = await Promise.all(
                        files.map(async (file) => {
                            if (file.url?.startsWith('blob:')) {
                                try {
                                    const res = await fetch(file.url)
                                    const blob = await res.blob()
                                    return new Promise<typeof file>((resolve) => {
                                        const reader = new FileReader()
                                        reader.onloadend = () => resolve({ ...file, url: reader.result as string })
                                        reader.onerror = () => resolve(file)
                                        reader.readAsDataURL(blob)
                                    })
                                } catch {
                                    return file
                                }
                            }
                            return file
                        })
                    )

                    onSend({ text, files: convertedFiles })
                    controller.textInput.clear()
                    controller.attachments.clear()
                }

                processBatch()
            }
        }
    }, [signal, onSend, controller])
    return null
}

function InputWatcher({ id, onUpdate }: { id: string, onUpdate: (id: string, hasValue: boolean) => void }) {
    const controller = usePromptInputController()
    const value = controller.textInput.value
    useEffect(() => {
        onUpdate(id, value.trim().length > 0)
    }, [id, value, onUpdate])
    return null
}

function FillWatcher({ signal, mode }: { signal: number, mode?: 'stream' | 'generate' | 'structured' }) {
    const controller = usePromptInputController()
    const lastProcessedSignal = useRef(0)

    useEffect(() => {
        if (signal > lastProcessedSignal.current) {
            lastProcessedSignal.current = signal
            const current = controller.textInput.value.trim()
            if (!current) {
                controller.textInput.setInput(generateRandomPrompt(mode))
            }
        }
    }, [signal, mode, controller])
    return null
}

// Optimized Message component
// During streaming: render raw text (zero parsing overhead, maximum paint speed)
// After generation complete: render through Streamdown for full markdown formatting
const MemoizedMessage = memo(({ message }: { message: ChatMessage }) => {
    return (
        <Message from={message.role} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MessageContent>
                {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {message.images.map((img, i) => (
                            <img
                                key={i}
                                src={img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}
                                alt="Uploaded content"
                                className="max-w-[240px] max-h-[240px] rounded-lg object-cover shadow-sm border border-border/50"
                            />
                        ))}
                    </div>
                )}
                {message.role === 'assistant' && message.thinking && (
                    <Reasoning isStreaming={message.isStreaming}>
                        <ReasoningTrigger />
                        <ReasoningContent>{message.thinking}</ReasoningContent>
                    </Reasoning>
                )}
                {message.role === 'assistant' && message.isStreaming ? (
                    <pre className="whitespace-pre-wrap wrap-break-word font-sans text-sm text-foreground leading-relaxed m-0">{message.content}<span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" /></pre>
                ) : (
                    <MessageResponse>{message.content}</MessageResponse>
                )}
            </MessageContent>
        </Message>
    )
})
MemoizedMessage.displayName = 'MemoizedMessage'

const visionCapabilityCache: Record<string, boolean> = {}

/**
 * SessionCard now manages its OWN streaming state (messages, stats, isGenerating).
 * The parent only passes down config (model, prompts, mode) and signals.
 * This means a chunk arriving for session A NEVER triggers a re-render of session B.
 */
export const SessionCard = memo(({ config, models, onUpdateConfig, onRemove, onInputUpdate, onStreamingStatus, bulkSendSignal, fillRandomSignal }: SessionCardProps) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const workerRef = useRef<Worker | null>(null)

    // ── LOCAL streaming state — only THIS card re-renders on chunk ──
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [stats, setStats] = useState<StreamDoneStats | undefined>(undefined)
    const [isGenerating, setIsGenerating] = useState(false)

    // ── Refs for mutable streaming state (avoids stale closures) ──
    const configRef = useRef(config)
    useEffect(() => { configRef.current = config })

    const messagesRef = useRef(messages)
    useEffect(() => { messagesRef.current = messages })

    // Track the current assistant message being streamed
    const activeAssistantIdRef = useRef<string | null>(null)

    // Notify parent about streaming status changes (for global metrics)
    const onStreamingStatusRef = useRef(onStreamingStatus)
    useEffect(() => { onStreamingStatusRef.current = onStreamingStatus })

    // Buffer for accumulating chunks before flushing to React state
    const chunkBufferRef = useRef<{ content: string; thinking: string } | null>(null)
    const rafIdRef = useRef<number | null>(null)

    // Setup Web Worker per session — handler set ONCE, never re-assigned
    useEffect(() => {
        const worker = new AgentWorker()
        workerRef.current = worker

        // Flush function: applies buffered content to React state via rAF
        const flushBuffer = () => {
            rafIdRef.current = null
            const buf = chunkBufferRef.current
            if (!buf) return
            const assistantMsgId = activeAssistantIdRef.current
            if (!assistantMsgId) return

            const mode = configRef.current.mode
            const content = mode === 'structured' ? `\`\`\`json\n${buf.content}\n\`\`\`` : buf.content
            const thinking = buf.thinking

            setMessages(prev => {
                const idx = prev.findIndex(m => m.id === assistantMsgId)
                if (idx === -1) return prev
                const updated = [...prev]
                updated[idx] = { ...updated[idx], content, thinking }
                return updated
            })
        }

        // Single stable message handler — uses refs so it never goes stale
        worker.onmessage = (e) => {
            const { id, action, chunk, error } = e.data
            const sid = configRef.current.id
            if (id !== sid) return

            const assistantMsgId = activeAssistantIdRef.current
            if (!assistantMsgId) return

            if (action === 'chunk') {
                const content = chunk.content || ''
                const thinking = chunk.thinking || ''

                if (chunk.done) {
                    // Cancel any pending rAF flush
                    if (rafIdRef.current !== null) {
                        cancelAnimationFrame(rafIdRef.current)
                        rafIdRef.current = null
                    }
                    chunkBufferRef.current = null

                    const mode = configRef.current.mode
                    const finalContent = mode === 'structured' ? `\`\`\`json\n${content}\n\`\`\`` : content

                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? { ...m, isStreaming: false, content: finalContent, thinking }
                            : m
                    ))
                    const doneStats: StreamDoneStats = {
                        totalDuration: chunk.totalDuration ?? 0,
                        loadDuration: chunk.loadDuration ?? 0,
                        promptEvalCount: chunk.promptEvalCount ?? 0,
                        promptEvalDuration: chunk.promptEvalDuration ?? 0,
                        evalCount: chunk.evalCount ?? 0,
                        evalDuration: chunk.evalDuration ?? 0,
                    }
                    setStats(doneStats)
                    setIsGenerating(false)
                    onStreamingStatusRef.current?.(sid, false, doneStats)
                } else {
                    const mode = configRef.current.mode
                    if (mode === 'generate') return // generate mode doesn't stream incrementally

                    // Buffer the chunk data and schedule a rAF flush
                    chunkBufferRef.current = { content, thinking }
                    if (rafIdRef.current === null) {
                        rafIdRef.current = requestAnimationFrame(flushBuffer)
                    }
                }
            } else if (action === 'error') {
                // Cancel any pending rAF flush
                if (rafIdRef.current !== null) {
                    cancelAnimationFrame(rafIdRef.current)
                    rafIdRef.current = null
                }
                chunkBufferRef.current = null

                const errorContent = '\n\n**Error:** ' + error
                const mode = configRef.current.mode

                setMessages(prev => {
                    const idx = prev.findIndex(m => m.id === assistantMsgId)
                    if (idx === -1) return prev
                    const updated = [...prev]
                    const existing = updated[idx].content || ''
                    const full = existing + errorContent
                    updated[idx] = {
                        ...updated[idx],
                        content: mode === 'structured' ? `\`\`\`json\n${full}\n\`\`\`` : full,
                        isStreaming: false,
                    }
                    return updated
                })
                setIsGenerating(false)
                onStreamingStatusRef.current?.(sid, false)
            }
        }

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current)
            }
            worker.terminate()
        }
    }, [])

    // Auto-scroll to bottom (only if already near bottom to avoid fighting the user)
    // Removed scroll-smooth from CardContent to prevent layout and render thrashing
    const isUserScrolledUpRef = useRef(false)

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const handleScroll = () => {
            // Check if user has scrolled up more than ~50px from the bottom
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
            isUserScrolledUpRef.current = !isNearBottom
        }

        el.addEventListener('scroll', handleScroll, { passive: true })
        return () => el.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        const el = scrollRef.current
        if (el && !isUserScrolledUpRef.current) {
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight
            })
        }
    }, [messages])

    const [hasVision, setHasVision] = useState(false)

    useEffect(() => {
        let mounted = true

        const checkVision = async () => {
            if (!config.model) {
                if (mounted) setHasVision(false)
                return
            }

            // Fast path: check names first
            const low = config.model.toLowerCase()
            if (low.includes('llava') || low.includes('moondream') || low.includes('vision') || low.includes('minicpm')) {
                if (mounted) setHasVision(true)
                return
            }

            // Then check tags if they exist
            const selected = models.find(m => m.name === config.model)
            const inTags = selected?.details?.families?.includes('vision') || false
            if (inTags) {
                if (mounted) setHasVision(true)
                return
            }

            // Return cached value if any
            if (config.model in visionCapabilityCache) {
                if (mounted) setHasVision(visionCapabilityCache[config.model] || false)
                return
            }

            try {
                const details = await showModel(config.model)
                const isVision = details.details?.families?.includes('vision') ||
                    details.capabilities?.includes('vision') ||
                    false
                visionCapabilityCache[config.model] = isVision
                if (mounted) setHasVision(isVision)
            } catch {
                if (mounted) setHasVision(false)
            }
        }

        checkVision()

        return () => { mounted = false }
    }, [config.model, models])

    const isVisionModel = hasVision

    // handleSend — works purely with local state + refs
    const handleSend = useCallback((msg: PromptInputMessage) => {
        if (!msg.text.trim()) return

        const c = configRef.current

        // Convert files to base64 if any
        const uiImages: string[] = []
        const apiImages: string[] = []
        if (msg.files?.length) {
            for (const filePart of msg.files) {
                if (filePart.url && filePart.url.startsWith('data:')) {
                    uiImages.push(filePart.url)
                    apiImages.push(filePart.url.split(',')[1])
                }
            }
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: msg.text,
            images: uiImages.length > 0 ? uiImages : undefined
        }

        const assistantMsgId = (Date.now() + 1).toString()
        activeAssistantIdRef.current = assistantMsgId

        const initialAssistantMessage: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: c.mode === 'structured' ? '```json\n\n```' : '',
            thinking: '',
            isStreaming: true,
        }

        // Capture current history from ref (no dependency on messages state)
        const currentMessages = messagesRef.current
        const history: { role: 'user' | 'assistant' | 'system', content: string }[] = currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
        }))

        // Update local state
        setMessages(prev => [...prev, userMessage, initialAssistantMessage])
        setIsGenerating(true)
        setStats(undefined)
        onStreamingStatusRef.current?.(c.id, true)

        // Cancel previous if any
        workerRef.current?.postMessage({ id: c.id, action: 'abort' })

        const systemPrompt = SYSTEM_PROMPTS[c.systemPromptId as keyof typeof SYSTEM_PROMPTS]?.prompt || ''
        const personality = PERSONALITIES[c.personalityId as keyof typeof PERSONALITIES]?.prompt || ''

        // Fire the worker — no onmessage re-assignment, handler is already set
        workerRef.current!.postMessage({
            id: c.id,
            action: 'start',
            payload: {
                model: c.model,
                prompt: msg.text,
                images: apiImages.length > 0 ? apiImages : undefined,
                systemPrompt,
                personality,
                history,
                format: c.mode === 'structured' ? 'json' : undefined,
            }
        })
    }, [])

    const handleStop = useCallback(() => {
        workerRef.current?.postMessage({ id: config.id, action: 'abort' })
        setIsGenerating(false)
        onStreamingStatusRef.current?.(config.id, false)
    }, [config.id])

    const handleClear = useCallback(() => {
        setMessages([])
        setStats(undefined)
    }, [])

    return (
        <Card className="py-0 flex flex-col h-full w-[400px] shrink-0 overflow-hidden border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border/50 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                    <Select
                        value={config.model}
                        onValueChange={(val) => onUpdateConfig(config.id, { model: val })}
                    >
                        <SelectTrigger className="w-[180px] h-8 text-xs font-medium">
                            <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map((m) => (
                                <SelectItem key={m.name} value={m.name} className="text-xs">
                                    {m.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleClear} title="Clear Chat">
                            <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemove(config.id)} title="Close Session">
                            <XIcon className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Select
                        value={config.systemPromptId}
                        onValueChange={(val) => onUpdateConfig(config.id, { systemPromptId: val })}
                    >
                        <SelectTrigger className="flex-1 h-7 text-[11px]">
                            <SelectValue placeholder="Prompt" />
                        </SelectTrigger>
                        <SelectContent>
                            {systemPromptList.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-[11px]">
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={config.personalityId}
                        onValueChange={(val) => onUpdateConfig(config.id, { personalityId: val })}
                    >
                        <SelectTrigger className="flex-1 h-7 text-[11px]">
                            <SelectValue placeholder="Personality" />
                        </SelectTrigger>
                        <SelectContent>
                            {personalityList.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-[11px]">
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={config.mode || 'stream'}
                        onValueChange={(val: 'stream' | 'generate' | 'structured') => onUpdateConfig(config.id, { mode: val })}
                    >
                        <SelectTrigger className="w-[100px] h-7 text-[11px]">
                            <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="stream" className="text-[11px]">Stream</SelectItem>
                            <SelectItem value="generate" className="text-[11px]">Generate</SelectItem>
                            <SelectItem value="structured" className="text-[11px]">Structured</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                        <div className="p-3 rounded-full bg-muted">
                            <PlayIcon className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">Ready to start</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <MemoizedMessage key={msg.id} message={msg} />
                    ))
                )}
            </CardContent>

            <CardFooter className="p-3 border-t border-border/50 bg-background flex-col gap-3">
                {stats && !isGenerating && (
                    <div className="w-full flex items-center justify-between px-2 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 text-[10px] text-green-600 dark:text-green-400 font-mono">
                        <div className="flex items-center gap-1.5">
                            <TimerIcon className="h-3 w-3" />
                            <span>{(stats.totalDuration / 1e9).toFixed(2)}s</span>
                        </div>
                        <span>{Math.round(stats.evalCount / (stats.evalDuration / 1e9))} t/s</span>
                    </div>
                )}
                <div className="w-full relative">
                    <PromptInputProvider initialInput={config.initialPrompt}>
                        <BulkReceiver signal={bulkSendSignal} onSend={handleSend} />
                        <InputWatcher id={config.id} onUpdate={onInputUpdate} />
                        <FillWatcher signal={fillRandomSignal} mode={config.mode} />
                        <PromptInput
                            accept="image/*"
                            className="bg-background border focus-within:ring-1 focus-within:ring-primary/30 rounded-xl shadow-sm"
                            onSubmit={handleSend}
                        >
                            <PromptInputHeader>
                                <AttachmentList />
                            </PromptInputHeader>
                            <PromptInputBody>
                                <PromptInputTextarea
                                    disabled={isGenerating}
                                />
                            </PromptInputBody>
                            <PromptInputFooter>
                                <PromptInputTools className="flex-1 w-full">
                                    {isVisionModel && (
                                        <ImagePickerButton disabled={isGenerating} />
                                    )}
                                </PromptInputTools>
                                <PromptInputSubmit
                                    status={isGenerating ? "streaming" : undefined}
                                    onStop={handleStop}
                                />
                            </PromptInputFooter>
                        </PromptInput>
                    </PromptInputProvider>
                </div>
            </CardFooter>
        </Card>
    )
})
SessionCard.displayName = 'SessionCard'
