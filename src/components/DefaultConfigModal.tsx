import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings2Icon, SaveIcon, XIcon, InfoIcon } from 'lucide-react'
import { systemPromptList, personalityList } from '@/lib/prompts'
import { showModel, type OllamaModel, type ModelDetails } from '@/lib/ollamaClient'
import { Label } from '@/components/ui/label'
import { Dialog as DialogPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "framer-motion"
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

export interface DefaultConfig {
    model: string
    systemPromptId: string
    personalityId: string
    mode: 'stream' | 'generate' | 'structured'
    prompt: string
    numCtx: number
    keepAlive: boolean
}

interface DefaultConfigModalProps {
    config: DefaultConfig
    models: OllamaModel[]
    onSave: (config: DefaultConfig) => void
}

/** Predefined context length steps for the slider ticks */
const CTX_STEPS = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]

/** Format a number to a human-readable context length label */
function formatCtx(value: number): string {
    if (value >= 1024) return `${Math.round(value / 1024)}k`
    return `${value}`
}

/**
 * Extract the max context length from model_info.
 * Looks for keys matching `{family}.context_length` pattern.
 */
function getMaxContextLength(modelDetails: ModelDetails | null): number {
    if (!modelDetails?.model_info) return 131072 // fallback
    const info = modelDetails.model_info
    for (const key of Object.keys(info)) {
        if (key.endsWith('.context_length')) {
            const val = Number(info[key])
            if (!isNaN(val) && val > 0) return val
        }
    }
    return 131072 // fallback default
}

/**
 * Get available slider steps up to and including the max context length.
 * Always includes 2048 as the minimum optimum.
 */
function getAvailableSteps(maxCtx: number): number[] {
    const steps = CTX_STEPS.filter(s => s <= maxCtx)
    // If the maxCtx itself is not in the predefined steps, add it
    if (steps.length === 0 || steps[steps.length - 1] !== maxCtx) {
        steps.push(maxCtx)
    }
    return steps
}

/** Snap a value to the nearest available step */
function snapToStep(value: number, steps: number[]): number {
    let closest = steps[0]
    let minDiff = Math.abs(value - steps[0])
    for (let i = 1; i < steps.length; i++) {
        const diff = Math.abs(value - steps[i])
        if (diff < minDiff) {
            minDiff = diff
            closest = steps[i]
        }
    }
    return closest
}

export function DefaultConfigModal({ config, models, onSave }: DefaultConfigModalProps) {
    const [localConfig, setLocalConfig] = useState<DefaultConfig>(config)
    const [isOpen, setIsOpen] = useState(false)
    const [modelDetails, setModelDetails] = useState<ModelDetails | null>(null)
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)

    useEffect(() => {
        setLocalConfig(config)
    }, [config])

    // Fetch model details when the selected model changes
    const fetchModelDetails = useCallback(async (modelName: string) => {
        if (!modelName) {
            setModelDetails(null)
            return
        }
        setIsLoadingDetails(true)
        try {
            const details = await showModel(modelName)
            setModelDetails(details)

            // Auto-set numCtx to current model's default or 4096 if not configured
            const maxCtx = getMaxContextLength(details)
            setLocalConfig(prev => {
                const steps = getAvailableSteps(maxCtx)
                // If current numCtx is beyond model's max, snap it down
                if (prev.numCtx > maxCtx || prev.numCtx === 0) {
                    const defaultCtx = Math.min(4096, maxCtx)
                    return { ...prev, numCtx: snapToStep(defaultCtx, steps) }
                }
                return prev
            })
        } catch (err) {
            console.warn('Failed to fetch model details for context length:', err)
            setModelDetails(null)
        } finally {
            setIsLoadingDetails(false)
        }
    }, [])

    // Fetch details when modal opens or model changes while open
    useEffect(() => {
        if (isOpen && localConfig.model) {
            fetchModelDetails(localConfig.model)
        }
    }, [isOpen, localConfig.model, fetchModelDetails])

    const maxCtx = getMaxContextLength(modelDetails)
    const availableSteps = getAvailableSteps(maxCtx)
    const minCtx = availableSteps[0]

    const handleSave = () => {
        onSave(localConfig)
        toast.success('Default configuration saved')
        setIsOpen(false)
    }

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
            <DialogPrimitive.Trigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border/50 h-8">
                    <Settings2Icon className="h-4 w-4" />
                    <span>Default Config</span>
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
                                className="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-[650px] gap-4 rounded-lg border p-6 shadow-lg outline-none max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex flex-col gap-2 text-center sm:text-left">
                                    <DialogPrimitive.Title className="text-lg leading-none font-semibold flex items-center gap-2">
                                        <Settings2Icon className="h-5 w-5 text-primary" />
                                        Default Session Configuration
                                    </DialogPrimitive.Title>
                                </div>
                                <DialogPrimitive.Close className="ring-offset-background focus:ring-ring hover:bg-accent hover:text-accent-foreground absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none p-1">
                                    <XIcon className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                </DialogPrimitive.Close>

                                <div className="space-y-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="model">Default Model</Label>
                                        <Select
                                            value={localConfig.model}
                                            onValueChange={(val) => setLocalConfig(prev => ({ ...prev, model: val }))}
                                        >
                                            <SelectTrigger id="model">
                                                <SelectValue placeholder="Select model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {models.map((m) => (
                                                    <SelectItem key={m.name} value={m.name}>
                                                        {m.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="systemPrompt">System Prompt</Label>
                                            <Select
                                                value={localConfig.systemPromptId}
                                                onValueChange={(val) => setLocalConfig(prev => ({ ...prev, systemPromptId: val }))}
                                            >
                                                <SelectTrigger id="systemPrompt">
                                                    <SelectValue placeholder="Prompt" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {systemPromptList.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="personality">Personality</Label>
                                            <Select
                                                value={localConfig.personalityId}
                                                onValueChange={(val) => setLocalConfig(prev => ({ ...prev, personalityId: val }))}
                                            >
                                                <SelectTrigger id="personality">
                                                    <SelectValue placeholder="Personality" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {personalityList.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="mode">Execution Mode</Label>
                                        <Select
                                            value={localConfig.mode}
                                            onValueChange={(val: 'stream' | 'generate' | 'structured') => setLocalConfig(prev => ({ ...prev, mode: val }))}
                                        >
                                            <SelectTrigger id="mode">
                                                <SelectValue placeholder="Mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="stream">Stream (Update as it generates)</SelectItem>
                                                <SelectItem value="generate">Generate (Wait for full response)</SelectItem>
                                                <SelectItem value="structured">Structured (JSON output)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* ── Context Length Slider ── */}
                                    <div className="grid gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Settings2Icon className="h-4 w-4 text-muted-foreground" />
                                                <Label className="text-sm font-semibold">Context Length</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
                                                            aria-label="Context length info"
                                                        >
                                                            <InfoIcon className="h-3 w-3 text-muted-foreground" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 text-sm space-y-3" side="top" align="start">
                                                        <p className="font-semibold text-foreground">Context Length</p>
                                                        <p className="text-muted-foreground leading-relaxed">
                                                            Context length determines how much of your conversation the model can remember and use to generate responses. Lower values save RAM.
                                                        </p>
                                                        <div className="space-y-1.5 rounded-md bg-muted/50 p-3 border border-border/50">
                                                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ollama VRAM Defaults</p>
                                                            <div className="text-xs space-y-1 text-muted-foreground font-mono">
                                                                <div className="flex justify-between">
                                                                    <span>&lt; 24 GiB VRAM</span>
                                                                    <span className="text-foreground font-semibold">4k context</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>24–48 GiB VRAM</span>
                                                                    <span className="text-foreground font-semibold">32k context</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>≥ 48 GiB VRAM</span>
                                                                    <span className="text-foreground font-semibold">256k context</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground/70 italic">
                                                            Setting <code className="bg-muted px-1 py-0.5 rounded text-[11px]">num_ctx</code> in the API overrides these defaults.
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <span className="text-sm font-mono font-bold text-primary tabular-nums">
                                                {formatCtx(localConfig.numCtx)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-muted-foreground -mt-1">
                                            Controls how much conversation the model can remember. Lower values use less RAM.
                                        </p>

                                        {isLoadingDetails ? (
                                            <div className="h-6 flex items-center">
                                                <div className="text-xs text-muted-foreground animate-pulse">Loading model context limits...</div>
                                            </div>
                                        ) : (
                                            <>
                                                <Slider
                                                    value={[availableSteps.indexOf(
                                                        snapToStep(localConfig.numCtx, availableSteps)
                                                    )]}
                                                    min={0}
                                                    max={availableSteps.length - 1}
                                                    step={1}
                                                    onValueChange={([idx]) => {
                                                        setLocalConfig(prev => ({
                                                            ...prev,
                                                            numCtx: availableSteps[idx]
                                                        }))
                                                    }}
                                                    className="w-full"
                                                />
                                                <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-0.5">
                                                    {availableSteps.map((step) => (
                                                        <span
                                                            key={step}
                                                            className={`transition-colors ${step === snapToStep(localConfig.numCtx, availableSteps)
                                                                ? 'text-primary font-bold'
                                                                : ''
                                                                }`}
                                                        >
                                                            {formatCtx(step)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70">
                                            <span>Min: {formatCtx(minCtx)}</span>
                                            <span>•</span>
                                            <span>Max: {formatCtx(maxCtx)}</span>
                                            {modelDetails && (
                                                <>
                                                    <span>•</span>
                                                    <span className="capitalize">{modelDetails.details.family} model</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Keep Alive Toggle ── */}
                                    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Label htmlFor="keepAlive" className="text-sm font-semibold cursor-pointer">
                                                    Keep Model Loaded
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
                                                            aria-label="Keep alive info"
                                                        >
                                                            <InfoIcon className="h-3 w-3 text-muted-foreground" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-72 text-sm space-y-2" side="top" align="start">
                                                        <p className="font-semibold text-foreground">Keep Alive</p>
                                                        <p className="text-muted-foreground leading-relaxed text-xs">
                                                            When enabled, the model stays loaded in memory indefinitely (<code className="bg-muted px-1 py-0.5 rounded text-[11px]">keep_alive: -1</code>), giving faster response times for subsequent prompts.
                                                        </p>
                                                        <p className="text-muted-foreground leading-relaxed text-xs">
                                                            When disabled, Ollama uses its default behavior — unloading the model after <strong>5 minutes</strong> of inactivity to free up RAM/VRAM.
                                                        </p>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {localConfig.keepAlive
                                                    ? 'Model persists in memory after response (faster follow-ups)'
                                                    : 'Model unloads after 5 min of inactivity (saves RAM/VRAM)'}
                                            </p>
                                        </div>
                                        <Switch
                                            id="keepAlive"
                                            checked={localConfig.keepAlive}
                                            onCheckedChange={(checked) =>
                                                setLocalConfig(prev => ({ ...prev, keepAlive: checked }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="prompt">Default Prompt Text</Label>
                                        <Textarea
                                            id="prompt"
                                            placeholder="Initial text for new sessions..."
                                            value={localConfig.prompt}
                                            onChange={(e) => setLocalConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                            className="min-h-[100px]"
                                        />
                                    </div>

                                    <Button className="w-full gap-2 mt-4" onClick={handleSave}>
                                        <SaveIcon className="h-4 w-4" />
                                        Save Defaults
                                    </Button>
                                </div>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    )
}
