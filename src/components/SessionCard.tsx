import { useRef, useEffect, useCallback } from 'react'
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
} from '@/components/ai-elements/prompt-input'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'
import { streamChat } from '@/lib/ollamaClient'
import type { StreamDoneStats, OllamaModel } from '@/lib/ollamaClient'
import { SYSTEM_PROMPTS, PERSONALITIES, systemPromptList, personalityList } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { XIcon, Trash2Icon, PlayIcon, TimerIcon } from 'lucide-react'
import { generateRandomPrompt } from '@/lib/dummy'

export type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    thinking?: string
    isStreaming?: boolean
}

export type SessionState = {
    id: string
    model: string
    systemPromptId: string
    personalityId: string
    mode: 'stream' | 'generate'
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

function BulkReceiver({ signal, onSend }: { signal: number, onSend: (msg: PromptInputMessage) => void }) {
    const controller = usePromptInputController()
    const lastProcessedSignal = useRef(0)

    useEffect(() => {
        if (signal > lastProcessedSignal.current) {
            lastProcessedSignal.current = signal
            const text = controller.textInput.value.trim()
            if (text) {
                onSend({ text, files: [] })
                controller.textInput.clear()
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

function FillWatcher({ signal }: { signal: number }) {
    const controller = usePromptInputController()
    const lastProcessedSignal = useRef(0)

    useEffect(() => {
        if (signal > lastProcessedSignal.current) {
            lastProcessedSignal.current = signal
            const current = controller.textInput.value.trim()
            if (!current) {
                controller.textInput.setInput(generateRandomPrompt())
            }
        }
    }, [signal, controller])
    return null
}

export function SessionCard({ session, models, onUpdate, onRemove, onInputUpdate, bulkSendSignal, fillRandomSignal }: SessionCardProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [session.messages])

    const handleSend = useCallback(async (msg: PromptInputMessage) => {
        if (!msg.text.trim()) return

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: msg.text,
        }

        const assistantMsgId = (Date.now() + 1).toString()
        const initialAssistantMessage: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
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

        let finalContent = ''
        let finalThinking = ''

        try {
            const systemPrompt = SYSTEM_PROMPTS[session.systemPromptId as keyof typeof SYSTEM_PROMPTS]?.prompt || ''
            const personality = PERSONALITIES[session.personalityId as keyof typeof PERSONALITIES]?.prompt || ''

            const stream = streamChat({
                model: session.model,
                prompt: msg.text,
                systemPrompt,
                personality,
                history,
                signal: abortControllerRef.current.signal,
            })

            let chunkCount = 0
            for await (const chunk of stream) {
                chunkCount++
                if (chunk.done) {
                    onUpdate(session.id, (prev: SessionState) => ({
                        // The final chunk contains all the stats properties directly
                        stats: chunk as StreamDoneStats,
                        isGenerating: false,
                        messages: prev.messages.map((m: ChatMessage) =>
                            m.id === assistantMsgId ? { ...m, isStreaming: false, content: finalContent, thinking: finalThinking } : m
                        )
                    }))
                    break
                }

                finalContent += chunk.content
                if (chunk.thinking) finalThinking += chunk.thinking

                // Stream updates if in 'stream' mode
                onUpdate(session.id, (prev: SessionState) => {
                    if (prev.mode === 'generate') {
                        return {}
                    }
                    const temp = [...prev.messages]
                    const lastIdx = temp.findIndex((m: ChatMessage) => m.id === assistantMsgId)
                    if (lastIdx !== -1) {
                        temp[lastIdx] = {
                            ...temp[lastIdx],
                            content: finalContent,
                            thinking: finalThinking,
                        }
                    }
                    return { messages: temp }
                })

                // Allow React to commit the batch and browser to paint when streaming locally very fast
                if (chunkCount % 2 === 0) {
                    await new Promise(r => setTimeout(r, 0))
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
                        temp[lastIdx] = { ...temp[lastIdx], content: finalContent, isStreaming: false }
                    }
                    return { isGenerating: false, messages: temp }
                })
            }
        }
    }, [session.id, session.messages, session.model, session.systemPromptId, session.personalityId, onUpdate])

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
                        onValueChange={(val: 'stream' | 'generate') => onUpdate(session.id, { mode: val })}
                    >
                        <SelectTrigger className="w-[100px] h-7 text-[11px]">
                            <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="stream" className="text-[11px]">Stream</SelectItem>
                            <SelectItem value="generate" className="text-[11px]">Generate</SelectItem>
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
                        <Message key={msg.id} from={msg.role}>
                            <MessageContent>
                                {msg.role === 'assistant' && msg.thinking && (
                                    <Reasoning isStreaming={msg.isStreaming}>
                                        <ReasoningTrigger />
                                        <ReasoningContent>{msg.thinking}</ReasoningContent>
                                    </Reasoning>
                                )}
                                <MessageResponse>{msg.content}</MessageResponse>
                            </MessageContent>
                        </Message>
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
                        <FillWatcher signal={fillRandomSignal} />
                        <PromptInput
                            className="bg-background border focus-within:ring-1 focus-within:ring-primary/30 rounded-xl shadow-sm"
                            onSubmit={handleSend}
                        >
                            <PromptInputBody>
                                <PromptInputTextarea
                                    disabled={session.isGenerating}
                                />
                            </PromptInputBody>
                            <PromptInputFooter>
                                <PromptInputTools className="flex-1 w-full" />
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
}

