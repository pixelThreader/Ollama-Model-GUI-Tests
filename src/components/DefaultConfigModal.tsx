import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings2Icon, SaveIcon, XIcon } from 'lucide-react'
import { systemPromptList, personalityList } from '@/lib/prompts'
import { type OllamaModel } from '@/lib/ollamaClient'
import { Label } from '@/components/ui/label'
import { Dialog as DialogPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "framer-motion"
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface DefaultConfig {
    model: string
    systemPromptId: string
    personalityId: string
    mode: 'stream' | 'generate' | 'structured'
    prompt: string
}

interface DefaultConfigModalProps {
    config: DefaultConfig
    models: OllamaModel[]
    onSave: (config: DefaultConfig) => void
}

export function DefaultConfigModal({ config, models, onSave }: DefaultConfigModalProps) {
    const [localConfig, setLocalConfig] = useState<DefaultConfig>(config)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setLocalConfig(config)
    }, [config])

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
                                className="bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-[650px] gap-4 rounded-lg border p-6 shadow-lg outline-none"
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
