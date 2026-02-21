import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { listRunningModels, unloadModel, type RunningModel } from '@/lib/ollamaClient'
import { MonitorIcon, RefreshCwIcon, Trash2Icon, AlertCircleIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function ActiveModelsModal() {
    const [runningModels, setRunningModels] = useState<RunningModel[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

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
            toast.success(`Unloaded ${name}`)
            await fetchRunningModels()
        } catch (err) {
            console.error('Failed to unload model:', err)
            toast.error(`Failed to unload ${name}`)
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

    return (
        <Dialog onOpenChange={(open) => open && fetchRunningModels()}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border/50 h-8">
                    <MonitorIcon className="h-4 w-4" />
                    <span>Active Models</span>
                    {runningModels.length > 0 && (
                        <Badge variant="secondary" className="ml-1 px-1.5 h-4 min-w-4 flex items-center justify-center text-[10px] bg-primary/20 text-primary border-0">
                            {runningModels.length}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                        <MonitorIcon className="h-5 w-5 text-primary" />
                        Running Models
                    </DialogTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={fetchRunningModels}
                        disabled={isLoading}
                    >
                        <RefreshCwIcon className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                </DialogHeader>

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
            </DialogContent>
        </Dialog>
    )
}

