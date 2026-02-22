import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings2Icon, SaveIcon } from 'lucide-react'
import { systemPromptList, personalityList } from '@/lib/prompts'
import { type OllamaModel } from '@/lib/ollamaClient'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface DefaultConfig {
    model: string
    systemPromptId: string
    personalityId: string
    mode: 'stream' | 'generate'
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
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border/50 h-8">
                    <Settings2Icon className="h-4 w-4" />
                    <span>Default Config</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2Icon className="h-5 w-5 text-primary" />
                        Default Session Configuration
                    </DialogTitle>
                </DialogHeader>

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
                            onValueChange={(val: 'stream' | 'generate') => setLocalConfig(prev => ({ ...prev, mode: val }))}
                        >
                            <SelectTrigger id="mode">
                                <SelectValue placeholder="Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="stream">Stream (Update as it generates)</SelectItem>
                                <SelectItem value="generate">Generate (Wait for full response)</SelectItem>
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
            </DialogContent>
        </Dialog>
    )
}
