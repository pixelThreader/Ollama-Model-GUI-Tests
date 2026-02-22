import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listModels, showModel, type OllamaModel, type ModelDetails } from '@/lib/ollamaClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ActivityIcon, CpuIcon, LayersIcon, ZapIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Component to load and display extended details for a model
const ModelDetailsView = ({ modelName }: { modelName: string }) => {
    const [details, setDetails] = useState<ModelDetails | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        showModel(modelName).then(data => {
            if (mounted) {
                setDetails(data)
                setLoading(false)
            }
        }).catch(() => {
            if (mounted) setLoading(false)
        })
        return () => { mounted = false }
    }, [modelName])

    if (loading) return <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading model insights...</div>
    if (!details) return <div className="p-4 text-sm text-destructive">Failed to load details.</div>

    return (
        <div className="space-y-4 p-4 bg-muted/20 rounded-md mt-2 border border-border/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span className="text-muted-foreground block mb-1">Family</span>
                    <span className="font-medium capitalize">{details.details.family || 'Unknown'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block mb-1">Parameter Size</span>
                    <span className="font-medium">{details.details.parameter_size || 'Unknown'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block mb-1">Format</span>
                    <span className="font-medium uppercase">{details.details.format || 'Unknown'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block mb-1">Quantization</span>
                    <span className="font-medium uppercase">{details.details.quantization_level || 'Unknown'}</span>
                </div>
            </div>

            {details.model_info && Object.keys(details.model_info).length > 0 && (
                <div>
                    <span className="text-muted-foreground block mb-2 text-sm">Capabilities & Info</span>
                    <div className="flex flex-wrap gap-2">
                        {details.model_info['general.architecture'] && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                Arch: {String(details.model_info['general.architecture'])}
                            </Badge>
                        )}
                        {details.model_info['general.parameter_count'] && (
                            <Badge variant="outline" className="border-primary/20">
                                Parameters: {(Number(details.model_info['general.parameter_count']) / 1e9).toFixed(1)}B
                            </Badge>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const Home = () => {
    const navigate = useNavigate()
    const [models, setModels] = useState<OllamaModel[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(true)

    const [workers, setWorkers] = useState<string>('5')
    const [selectedModel, setSelectedModel] = useState<string>('')

    useEffect(() => {
        let mounted = true
        const fetchModels = async () => {
            try {
                const fetched = await listModels()
                if (mounted) {
                    setModels(fetched)
                    if (fetched.length > 0) {
                        setSelectedModel(fetched[0].name)
                    }
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

    const handleStartBenchmark = () => {
        if (!selectedModel || !workers) return
        navigate({
            to: '/chat',
            search: {
                workers: Number(workers),
                model: selectedModel
            }
        })
    }

    return (
        <div className="flex flex-col h-full w-full overflow-y-auto relative bg-background">
            {/* Aesthetic Background Blobs */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-[100px] pointer-events-none -z-10" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-blue-500/10 via-purple-500/5 to-transparent blur-[120px] pointer-events-none -z-10" />

            <div className="container max-w-6xl mx-auto py-12 px-6 space-y-12 z-0 mt-8">

                {/* Hero Section */}
                <div className="space-y-4 text-center max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 border border-primary/20 shadow-sm shadow-primary/10">
                        <ZapIcon className="w-4 h-4" />
                        <span>High-Concurrency Testing Engine</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
                        Stress Test Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Local LLMs</span>
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Deploy multiple parallel agent workers instantly. Real-time token streaming, zero-bottleneck architecture, built directly for Ollama.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left Column: Quick Launch */}
                    <div className="lg:col-span-5 space-y-6">
                        <Card className="border-border/50 shadow-lg shadow-background/5 bg-background/60 backdrop-blur supports-backdrop-filter:bg-background/40">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                                    <ZapIcon className="w-5 h-5 text-primary" />
                                    Quick Benchmark
                                </CardTitle>
                                <CardDescription>Configure and deploy parallel workers instantly.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <LayersIcon className="w-4 h-4 text-muted-foreground" />
                                            Number of Workers
                                        </label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={workers}
                                            onChange={(e) => setWorkers(e.target.value)}
                                            className="bg-muted/50 border-border/50 focus-visible:ring-primary h-12 text-lg px-4"
                                            placeholder="e.g. 5"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <CpuIcon className="w-4 h-4 text-muted-foreground" />
                                            Target Model
                                        </label>
                                        <Select
                                            value={selectedModel}
                                            onValueChange={setSelectedModel}
                                            disabled={isLoadingModels || models.length === 0}
                                        >
                                            <SelectTrigger className="bg-muted/50 border-border/50 h-12 text-base px-4">
                                                <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select a model"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {models.map(m => (
                                                    <SelectItem key={m.name} value={m.name} className="py-3 cursor-pointer">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground">{m.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {(m.size / 1024 / 1024 / 1024).toFixed(1)} GB • {m.details.parameter_size}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleStartBenchmark}
                                    disabled={!selectedModel || !workers || isLoadingModels || models.length === 0}
                                    size="lg"
                                    className="w-full h-14 text-base font-bold bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <ActivityIcon className="w-5 h-5 mr-2 animate-pulse" />
                                    Launch {workers ? workers : '0'} Workers
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Predefined Test Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => { setWorkers('3'); if (models.length) setSelectedModel(models[0].name) }}>
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 mb-1">
                                        <LayersIcon className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-sm">Light Load</h3>
                                    <p className="text-xs text-muted-foreground">3 Agents parallel</p>
                                </CardContent>
                            </Card>
                            <Card className="border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => { setWorkers('15'); if (models.length) setSelectedModel(models[0].name) }}>
                                <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="p-2 rounded-full bg-red-500/10 text-red-500 mb-1">
                                        <ZapIcon className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-sm">Stress Test</h3>
                                    <p className="text-xs text-muted-foreground">15 Agents parallel</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Right Column: Model Library */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <InfoIcon className="w-5 h-5 text-primary" />
                                Model Library
                            </h2>
                            <Badge variant="outline" className="text-muted-foreground font-normal border-primary/20 bg-primary/5 text-primary">
                                {models.length} Models Available
                            </Badge>
                        </div>

                        {isLoadingModels ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse border border-border/50" />
                                ))}
                            </div>
                        ) : models.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border/60 rounded-xl bg-muted/10">
                                <ShieldAlertIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                                <h3 className="text-base font-semibold text-foreground">No Models Found</h3>
                                <p className="text-sm text-muted-foreground mt-1">Make sure Ollama is running locally and you have pulled at least one model.</p>
                            </div>
                        ) : (
                            <Accordion type="single" collapsible className="w-full space-y-2">
                                {models.map((model) => (
                                    <AccordionItem
                                        key={model.name}
                                        value={model.name}
                                        className="bg-card border border-border/50 rounded-xl px-4 overflow-hidden data-[state=open]:ring-1 data-[state=open]:ring-primary/20 transition-all shadow-sm shadow-background/5"
                                    >
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                                                        <CpuIcon className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="font-bold text-base hover:text-primary transition-colors">{model.name}</span>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="bg-muted px-2 py-0.5 rounded-full border border-border/50">{model.details.parameter_size}</span>
                                                            <span className="bg-muted px-2 py-0.5 rounded-full border border-border/50">{(model.size / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-4 pt-1">
                                            <ModelDetailsView modelName={model.name} />
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export const Route = createFileRoute('/')({
    component: Home,
})

export default Home