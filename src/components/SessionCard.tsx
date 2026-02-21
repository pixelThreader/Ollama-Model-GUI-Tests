import { useRef, useEffect } from 'react'
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
    PromptInputSelect,
    PromptInputSelectTrigger,
    PromptInputSelectValue,
    PromptInputSelectContent,
    PromptInputSelectItem,
} from '@/components/ai-elements/prompt-input'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'
import { streamChat } from '@/lib/ollamaClient'
import type { StreamDoneStats, OllamaModel } from '@/lib/ollamaClient'
import { SYSTEM_PROMPTS, PERSONALITIES, systemPromptList, personalityList } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { XIcon, Trash2Icon, SendIcon, PlayIcon, TimerIcon } from 'lucide-react'

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
    messages: ChatMessage[]
    stats?: StreamDoneStats
    isGenerating: boolean
}

interface SessionCardProps {
    session: SessionState
    models: OllamaModel[]
    onUpdate: (id: string, updates: Partial<SessionState> | ((prev: SessionState) => Partial<SessionState>)) => void
    onRemove: (id: string) => void
}

export function SessionCard({ session, models, onUpdate, onRemove }: SessionCardProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [session.messages])

    const handleSend = async (msg: PromptInputMessage) => {
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
        history.push({ role: 'user', content: msg.text })

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

            for await (const chunk of stream) {
                if (chunk.done) {
                    onUpdate(session.id, (prev: SessionState) => ({
                        // Cast chunk to the returned type with stats
                        stats: (chunk as any).stats as StreamDoneStats,
                        isGenerating: false,
                        messages: prev.messages.map((m: ChatMessage) =>
                            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
                        )
                    }))
                    break
                }

                finalContent += chunk.content
                if (chunk.thinking) finalThinking += chunk.thinking

                // Update the last message
                onUpdate(session.id, (prev: SessionState) => {
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
            }
        } catch (e: any) {
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
    }

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            onUpdate(session.id, { isGenerating: false })
        }
    }

    const handleClear = () => {
        onUpdate(session.id, { messages: [], stats: undefined })
    }

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
                    <PromptInputProvider>
                        <PromptInput
                            className="bg-muted/50 border-0 focus-within:ring-1 focus-within:ring-primary/30 rounded-xl"
                            onSubmit={handleSend}
                        >
                            <PromptInputBody>
                                <PromptInputTextarea
                                    disabled={session.isGenerating}
                                />
                            </PromptInputBody>
                            <PromptInputFooter>
                                <PromptInputTools className="flex-1 w-full flex-wrap">
                                    <PromptInputSelect
                                        value={session.systemPromptId}
                                        onValueChange={(val) => onUpdate(session.id, { systemPromptId: val })}
                                    >
                                        <PromptInputSelectTrigger className="h-7 text-[11px] w-[140px]">
                                            <PromptInputSelectValue placeholder="Prompt" />
                                        </PromptInputSelectTrigger>
                                        <PromptInputSelectContent>
                                            {systemPromptList.map((p) => (
                                                <PromptInputSelectItem key={p.id} value={p.id} className="text-[11px]">
                                                    {p.label}
                                                </PromptInputSelectItem>
                                            ))}
                                        </PromptInputSelectContent>
                                    </PromptInputSelect>

                                    <PromptInputSelect
                                        value={session.personalityId}
                                        onValueChange={(val) => onUpdate(session.id, { personalityId: val })}
                                    >
                                        <PromptInputSelectTrigger className="h-7 text-[11px] w-[140px]">
                                            <PromptInputSelectValue placeholder="Personality" />
                                        </PromptInputSelectTrigger>
                                        <PromptInputSelectContent>
                                            {personalityList.map((p) => (
                                                <PromptInputSelectItem key={p.id} value={p.id} className="text-[11px]">
                                                    {p.label}
                                                </PromptInputSelectItem>
                                            ))}
                                        </PromptInputSelectContent>
                                    </PromptInputSelect>
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
}

