
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { SessionCard } from '@/components/SessionCard'
import type { SessionState } from '@/components/SessionCard'
import { listModels } from '@/lib/ollamaClient'
import type { OllamaModel } from '@/lib/ollamaClient'
import { Button } from '@/components/ui/button'
import { PlusIcon, LayersIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { ActiveModelsModal } from '@/components/ActiveModelsModal'
import { SendIcon, SparklesIcon } from 'lucide-react'
import { DefaultConfigModal, type DefaultConfig } from '@/components/DefaultConfigModal'


const Chat = () => {
    const [sessions, setSessions] = useState<SessionState[]>([])
    const [models, setModels] = useState<OllamaModel[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(true)
    const [bulkSendSignal, setBulkSendSignal] = useState(0)
    const [fillRandomSignal, setFillRandomSignal] = useState(0)
    const [inputStates, setInputStates] = useState<Record<string, boolean>>({})

    const [defaultConfig, setDefaultConfig] = useState<DefaultConfig>(() => {
        const saved = localStorage.getItem('ollama_default_config')
        if (saved) {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.error('Failed to parse default config', e)
            }
        }
        return {
            model: '',
            systemPromptId: 'general',
            personalityId: 'neutral',
            mode: 'stream' as const,
            prompt: '',
        }
    })

    useEffect(() => {
        localStorage.setItem('ollama_default_config', JSON.stringify(defaultConfig))
    }, [defaultConfig])

    useEffect(() => {
        let mounted = true
        const fetchModels = async () => {
            try {
                const fetched = await listModels()
                if (mounted) {
                    setModels(fetched)
                    setIsLoadingModels(false)
                }
            } catch (err) {
                console.error('Failed to load models:', err)
                if (mounted) setIsLoadingModels(false)
            }
        }
        fetchModels()
        return () => { mounted = false }
    }, [])

    const handleAddSession = useCallback(() => {
        const newSession: SessionState = {
            id: nanoid(),
            model: defaultConfig.model || (models.length > 0 ? models[0].name : ''),
            systemPromptId: defaultConfig.systemPromptId,
            personalityId: defaultConfig.personalityId,
            mode: defaultConfig.mode,
            initialPrompt: defaultConfig.prompt,
            messages: [],
            isGenerating: false,
        }
        setSessions((prev) => [...prev, newSession])
    }, [defaultConfig, models])

    const handleRemoveSession = useCallback((id: string) => {
        setSessions((prev) => prev.filter((s) => s.id !== id))
        setInputStates((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
        })
    }, [])

    const handleBulkSend = useCallback(() => {
        setBulkSendSignal((prev) => prev + 1)
    }, [])

    const handleFillRandom = useCallback(() => {
        setFillRandomSignal((prev) => prev + 1)
    }, [])

    const handleInputUpdate = useCallback((id: string, hasValue: boolean) => {
        setInputStates((prev) => {
            if (prev[id] === hasValue) return prev
            return { ...prev, [id]: hasValue }
        })
    }, [])

    const handleUpdateSession = useCallback((id: string, updates: Partial<SessionState> | ((prev: SessionState) => Partial<SessionState>)) => {
        setSessions((prev) =>
            prev.map((session) => {
                if (session.id === id) {
                    // Allow functional updates
                    const resolvedUpdates = typeof updates === 'function' ? updates(session) : updates
                    return { ...session, ...resolvedUpdates }
                }
                return session
            })
        )
    }, [])

    // Calculate global metrics if multiple are done
    const completedSessions = sessions.filter(s => s.stats && !s.isGenerating)
    const totalTokens = completedSessions.reduce((acc, s) => acc + (s.stats?.evalCount || 0), 0)
    const activeCount = sessions.filter(s => s.isGenerating).length

    return (
        <div className="flex flex-col h-full w-full overflow-hidden absolute inset-0 pt-14">
            {/* Kanban Header / Global Controls */}
            <div className="flex-none h-14 border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center justify-between px-6 z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold">
                        <LayersIcon className="h-5 w-5 text-primary" />
                        <span>Concurrency Kanban</span>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
                        {sessions.length} Session{sessions.length !== 1 ? 's' : ''} Active
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {completedSessions.length > 0 && (
                        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-muted-foreground pr-4 border-r border-border/40">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wider opacity-70">Total Tokens</span>
                                <span className="font-semibold text-foreground">{totalTokens.toLocaleString()}</span>
                            </div>
                            {activeCount > 0 && (
                                <div className="flex items-center gap-2 text-amber-500">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                    {activeCount} Generating
                                </div>
                            )}
                        </div>
                    )}

                    {sessions.length > 1 && Object.values(inputStates).some(v => v) && (
                        <Button
                            onClick={handleBulkSend}
                            size="sm"
                            variant="outline"
                            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                        >
                            <SendIcon className="h-4 w-4" />
                            Bulk Send
                        </Button>
                    )}

                    <ActiveModelsModal />

                    {sessions.length > 0 && (
                        <Button
                            onClick={handleFillRandom}
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-muted-foreground hover:text-primary transition-colors"
                        >
                            <SparklesIcon className="h-4 w-4" />
                            Fill Empty
                        </Button>
                    )}

                    <DefaultConfigModal
                        config={defaultConfig}
                        models={models}
                        onSave={setDefaultConfig}
                    />

                    <Button
                        onClick={handleAddSession}
                        size="sm"
                        className="gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-0"
                        disabled={isLoadingModels}
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add Session
                    </Button>
                </div>
            </div>

            {/* Kanban Board Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden bg-dot-pattern bg-size-[24px_24px]">
                <div className="flex h-full min-w-max p-6 gap-6 items-start">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center w-full h-[60vh] text-muted-foreground opacity-60 space-y-4">
                            <LayersIcon className="h-16 w-16 mb-2" strokeWidth={1} />
                            <p className="text-xl">No active chat sessions.</p>
                            <p className="text-sm">Add a session to start benchmarking concurrency.</p>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                models={models}
                                onUpdate={handleUpdateSession}
                                onRemove={handleRemoveSession}
                                onInputUpdate={handleInputUpdate}
                                bulkSendSignal={bulkSendSignal}
                                fillRandomSignal={fillRandomSignal}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export const Route = createFileRoute('/chat')({
    component: Chat,
})