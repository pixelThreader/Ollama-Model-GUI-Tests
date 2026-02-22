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
import { streamChat, showModel } from '@/lib/ollamaClient'
import type { StreamDoneStats, OllamaModel } from '@/lib/ollamaClient'
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

export type SessionState = {
    id: string
    model: string
    systemPromptId: string
    personalityId: string
    mode: 'stream' | 'generate' | 'structured'
    messages: ChatMessage[]
    stats?: StreamDoneStats
    isGenerating: boolean
    initialPrompt?: string
}

interface SessionCardProps {
    session: SessionState
    models: OllamaModel[]
    onUpdate: (id: string, updates: Partial<SessionState> | ((prev: SessionState) => Partial<SessionState>)) => void
    onRemove: (id: string) => void
    onInputUpdate: (id: string, hasValue: boolean) => void
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
                <MessageResponse>{message.content}</MessageResponse>
            </MessageContent>
        </Message>
    )
})
MemoizedMessage.displayName = 'MemoizedMessage'

const visionCapabilityCache: Record<string, boolean> = {}

export const SessionCard = memo(({ session, models, onUpdate, onRemove, onInputUpdate, bulkSendSignal, fillRandomSignal }: SessionCardProps) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [session.messages])

    const [hasVision, setHasVision] = useState(false)

    useEffect(() => {
        if (!session.model) {
            setHasVision(false)
            return
        }

        // Fast path: check names first
        const low = session.model.toLowerCase()
        if (low.includes('llava') || low.includes('moondream') || low.includes('vision') || low.includes('minicpm')) {
            setHasVision(true)
            return
        }

        // Then check tags if they exist
        const selected = models.find(m => m.name === session.model)
        const inTags = selected?.details?.families?.includes('vision') || false
        if (inTags) {
            setHasVision(true)
            return
        }

        // Return cached value if any
        if (session.model in visionCapabilityCache) {
            setHasVision(visionCapabilityCache[session.model] || false)
            return
        }

        let mounted = true
        showModel(session.model).then(details => {
            const isVision = details.details?.families?.includes('vision') ||
                details.capabilities?.includes('vision') ||
                false
            visionCapabilityCache[session.model] = isVision
            if (mounted) setHasVision(isVision)
        }).catch(() => {
            // Silently ignore failures, might be a network glitch
            if (mounted) setHasVision(false)
        })
        return () => { mounted = false }
    }, [session.model, models])

    const isVisionModel = hasVision

    const handleSend = useCallback((msg: PromptInputMessage) => {
        if (!msg.text.trim()) return

        // Convert files to base64 if any
        const uiImages: string[] = []
        const apiImages: string[] = []
        if (msg.files?.length) {
            for (const filePart of msg.files) {
                if (filePart.url && filePart.url.startsWith('data:')) {
                    uiImages.push(filePart.url) // Keep full data URI for UI rendering
                    // Extract base64 from data URL for API
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
        const initialAssistantMessage: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: session.mode === 'structured' ? '```json\n\n```' : '',
            thinking: '',
            isStreaming: true,
        }

        // Capture current history
        const history: { role: 'user' | 'assistant' | 'system', content: string }[] = session.messages.map((m) => ({
            role: m.role,
            content: m.content,
        }))

        onUpdate(session.id, {
            messages: [...session.messages, userMessage, initialAssistantMessage],
            isGenerating: true,
            stats: undefined,
        })

        abortControllerRef.current = new AbortController()

        const runAsync = async () => {
            let finalContent = ''
            let finalThinking = ''

            try {
                const systemPrompt = SYSTEM_PROMPTS[session.systemPromptId as keyof typeof SYSTEM_PROMPTS]?.prompt || ''
                const personality = PERSONALITIES[session.personalityId as keyof typeof PERSONALITIES]?.prompt || ''

                const stream = streamChat({
                    model: session.model,
                    prompt: msg.text,
                    images: apiImages.length > 0 ? apiImages : undefined,
                    systemPrompt,
                    personality,
                    history,
                    signal: abortControllerRef.current?.signal,
                    format: session.mode === 'structured' ? 'json' : undefined,
                })

                let lastUpdateTime = Date.now()
                for await (const chunk of stream) {
                    if (chunk.done) {
                        onUpdate(session.id, (prev: SessionState) => ({
                            stats: chunk as StreamDoneStats,
                            isGenerating: false,
                            messages: prev.messages.map((m: ChatMessage) =>
                                m.id === assistantMsgId ? { ...m, isStreaming: false, content: prev.mode === 'structured' ? `\`\`\`json\n${finalContent}\n\`\`\`` : finalContent, thinking: finalThinking } : m
                            )
                        }))
                        break
                    }

                    finalContent += chunk.content
                    if (chunk.thinking) finalThinking += chunk.thinking

                    const now = Date.now()
                    if (now - lastUpdateTime > 50) {
                        lastUpdateTime = now
                        onUpdate(session.id, (prev: SessionState) => {
                            if (prev.mode === 'generate') return {}
                            const temp = [...prev.messages]
                            const lastIdx = temp.findIndex((m: ChatMessage) => m.id === assistantMsgId)
                            if (lastIdx !== -1) {
                                temp[lastIdx] = {
                                    ...temp[lastIdx],
                                    content: prev.mode === 'structured' ? `\`\`\`json\n${finalContent}\n\`\`\`` : finalContent,
                                    thinking: finalThinking,
                                }
                            }
                            return { messages: temp }
                        })
                    }
                }
            } catch (err: unknown) {
                const e = err as Error
                if (e.name !== 'AbortError') {
                    finalContent += '\n\n**Error:** ' + e.message
                    onUpdate(session.id, (prev: SessionState) => {
                        const temp = [...prev.messages]
                        const lastIdx = temp.findIndex((m: ChatMessage) => m.id === assistantMsgId)
                        if (lastIdx !== -1) {
                            temp[lastIdx] = { ...temp[lastIdx], content: prev.mode === 'structured' ? `\`\`\`json\n${finalContent}\n\`\`\`` : finalContent, isStreaming: false }
                        }
                        return { isGenerating: false, messages: temp }
                    })
                }
            }
        }

        runAsync()
    }, [session.id, session.messages, session.model, session.systemPromptId, session.personalityId, session.mode, onUpdate])

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            onUpdate(session.id, { isGenerating: false })
        }
    }, [session.id, onUpdate])

    const handleClear = useCallback(() => {
        onUpdate(session.id, { messages: [], stats: undefined })
    }, [session.id, onUpdate])

    return (
        <Card className="py-0 flex flex-col h-full w-[400px] shrink-0 overflow-hidden border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-3 border-b border-border/50 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                    <Select
                        value={session.model}
                        onValueChange={(val) => onUpdate(session.id, { model: val })}
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemove(session.id)} title="Close Session">
                            <XIcon className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Select
                        value={session.systemPromptId}
                        onValueChange={(val) => onUpdate(session.id, { systemPromptId: val })}
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
                        value={session.personalityId}
                        onValueChange={(val) => onUpdate(session.id, { personalityId: val })}
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
                        value={session.mode || 'stream'}
                        onValueChange={(val: 'stream' | 'generate' | 'structured') => onUpdate(session.id, { mode: val })}
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

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref={scrollRef}>
                {session.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                        <div className="p-3 rounded-full bg-muted">
                            <PlayIcon className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium">Ready to start</p>
                    </div>
                ) : (
                    session.messages.map((msg) => (
                        <MemoizedMessage key={msg.id} message={msg} />
                    ))
                )}
            </CardContent>

            <CardFooter className="p-3 border-t border-border/50 bg-background flex-col gap-3">
                {session.stats && !session.isGenerating && (
                    <div className="w-full flex items-center justify-between px-2 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 text-[10px] text-green-600 dark:text-green-400 font-mono">
                        <div className="flex items-center gap-1.5">
                            <TimerIcon className="h-3 w-3" />
                            <span>{(session.stats.totalDuration / 1e9).toFixed(2)}s</span>
                        </div>
                        <span>{Math.round(session.stats.evalCount / (session.stats.evalDuration / 1e9))} t/s</span>
                    </div>
                )}
                <div className="w-full relative">
                    <PromptInputProvider initialInput={session.initialPrompt}>
                        <BulkReceiver signal={bulkSendSignal} onSend={handleSend} />
                        <InputWatcher id={session.id} onUpdate={onInputUpdate} />
                        <FillWatcher signal={fillRandomSignal} mode={session.mode} />
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
                                    disabled={session.isGenerating}
                                />
                            </PromptInputBody>
                            <PromptInputFooter>
                                <PromptInputTools className="flex-1 w-full">
                                    {isVisionModel && (
                                        <ImagePickerButton disabled={session.isGenerating} />
                                    )}
                                </PromptInputTools>
                                <PromptInputSubmit
                                    status={session.isGenerating ? "streaming" : undefined}
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
