import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Dialog as DialogPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { listRunningModels, unloadModel, type RunningModel } from '@/lib/ollamaClient'
import { MonitorIcon, RefreshCwIcon, Trash2Icon, AlertCircleIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function ActiveModelsModal() {
    const [runningModels, setRunningModels] = useState<RunningModel[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const fetchRunningModels = async () => {
        setIsLoading(true)
        try {
            const models = await listRunningModels()
            setRunningModels(models)
        } catch (err) {
            console.error('Failed to fetch running models:', err)
            toast.error('Failed to fetch active models')
        } finally {
            setIsLoading(false)
        }
    }

    const handleUnload = async (name: string) => {
        setIsActionLoading(name)
        try {
            await unloadModel(name)

            // Optimistically remove the model from the list immediately
            setRunningModels(prev => prev.filter(m => m.name !== name))

            // Poll until Ollama confirms the model is actually gone
            const MAX_RETRIES = 10
            const POLL_INTERVAL = 500 // ms

            let confirmed = false
            for (let i = 0; i < MAX_RETRIES; i++) {
                await new Promise(r => setTimeout(r, POLL_INTERVAL))
                const current = await listRunningModels()
                const stillRunning = current.some(m => m.name === name)

                if (!stillRunning) {
                    confirmed = true
                    setRunningModels(current)
                    break
                }
            }

            if (confirmed) {
                toast.success(`Unloaded ${name}`)
            } else {
                // Model stubbornly still around after 5s — restore actual list
                const fallback = await listRunningModels()
                setRunningModels(fallback)
                toast.warning(`${name} is taking longer than expected to unload`)
            }
        } catch (err) {
            console.error('Failed to unload model:', err)
            toast.error(`Failed to unload ${name}`)
            // Re-fetch to restore the accurate list
            try {
                const fallback = await listRunningModels()
                setRunningModels(fallback)
            } catch { /* ignore */ }
        } finally {
            setIsActionLoading(null)
        }
    }

    // Format bytes to human readable
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (open) fetchRunningModels()
    }

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
            <DialogPrimitive.Trigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border/50 h-8">
                    <MonitorIcon className="h-4 w-4" />
                    <span>Active Models</span>
                    {runningModels.length > 0 && (
                        <Badge variant="secondary" className="ml-1 px-1.5 h-4 min-w-4 flex items-center justify-center text-[10px] bg-primary/20 text-primary border-0">
                            {runningModels.length}
                        </Badge>
                    )}
                </Button>
            </DialogPrimitive.Trigger>

            <AnimatePresence>
                {isOpen && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 bg-black/50"
                            />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content asChild forceMount>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.85, y: "-50%", x: "-50%" }}
                                animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
                                exit={{ opacity: 0, scale: 0.85, y: "-50%", x: "-50%" }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-[500px] gap-4 rounded-lg border p-6 shadow-lg outline-none"
                            >
                                <div className="flex flex-col gap-2 text-center sm:text-left">
                                    <DialogPrimitive.Title className="text-lg leading-none font-semibold flex items-center gap-2">
                                        <MonitorIcon className="h-5 w-5 text-primary" />
                                        Running Models
                                    </DialogPrimitive.Title>
                                </div>

                                {/* Refresh + Close buttons */}
                                <div className="absolute top-4 right-4 flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={fetchRunningModels}
                                        disabled={isLoading}
                                    >
                                        <RefreshCwIcon className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                    </Button>
                                    <DialogPrimitive.Close className="ring-offset-background focus:ring-ring hover:bg-accent hover:text-accent-foreground rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none p-1">
                                        <XIcon className="h-4 w-4" />
                                        <span className="sr-only">Close</span>
                                    </DialogPrimitive.Close>
                                </div>

                                <div className="space-y-4 py-4">
                                    {runningModels.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-60">
                                            <MonitorIcon className="h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">No models currently loaded</p>
                                                <p className="text-xs text-muted-foreground">Models are loaded into RAM when you start a chat.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {runningModels.map((model) => (
                                                <div
                                                    key={model.name}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm">{model.name}</span>
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 border-primary/20 bg-primary/5 text-primary">
                                                                {model.details.parameter_size}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono uppercase tracking-tight">
                                                            <span>{formatSize(model.size_vram)} VRAM</span>
                                                            <span>{model.details.quantization_level}</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleUnload(model.name)}
                                                        disabled={isActionLoading === model.name}
                                                    >
                                                        {isActionLoading === model.name ? (
                                                            <RefreshCwIcon className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2Icon className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400/90 leading-relaxed">
                                    <AlertCircleIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    <p>
                                        Unloading an active model will free up RAM/VRAM. Ollama automatically unloads models after 5 minutes of inactivity by default.
                                    </p>
                                </div>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    )
}
