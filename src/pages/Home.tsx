import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listModels, showModel, type OllamaModel, type ModelDetails } from '@/lib/ollamaClient'
import { Dialog as DialogPrimitive } from "radix-ui"
import { AnimatePresence, motion } from "framer-motion"


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ActivityIcon, CpuIcon, LayersIcon, ZapIcon, InfoIcon, ShieldAlertIcon, FileTextIcon, TerminalIcon, CalendarIcon, PackageIcon, XIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

// Component to display extended details for a model
const ModelDetailsView = ({ details }: { details: ModelDetails }) => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <div className="space-y-4 p-4 bg-muted/20 rounded-md mt-2 border border-border/50">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                        <PackageIcon className="w-3 h-3" /> Family
                    </span>
                    <span className="font-medium capitalize block truncate">{details.details.family || 'Unknown'}</span>
                </div>
                <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                        <CpuIcon className="w-3 h-3" /> Parameters
                    </span>
                    <span className="font-medium block truncate text-primary">{details.details.parameter_size || 'Unknown'}</span>
                </div>
                <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                        <FileTextIcon className="w-3 h-3" /> Format
                    </span>
                    <span className="font-medium block truncate uppercase">{details.details.format || 'Unknown'}</span>
                </div>
                <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                        <LayersIcon className="w-3 h-3" /> Quantization
                    </span>
                    <span className="font-medium block truncate uppercase">{details.details.quantization_level || 'Unknown'}</span>
                </div>
                <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold">
                        <CalendarIcon className="w-3 h-3" /> Modified
                    </span>
                    <span className="font-medium block truncate">{new Date(details.modified_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
            </div>

            <div className="space-y-3">
                <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">Capabilities</span>
                <div className="flex flex-wrap gap-2">
                    {details.capabilities.map(cap => (
                        <Badge key={cap} variant="outline" className="text-[10px] bg-muted capitalize">
                            {cap}
                        </Badge>
                    ))}
                </div>
            </div>

            {details.model_info && Object.keys(details.model_info).length > 0 && (
                <div className="space-y-3">
                    <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">Model Info</span>
                    <div className="flex flex-wrap gap-2">
                        {Boolean(details.model_info['general.architecture']) && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px]">
                                Arch: {String(details.model_info['general.architecture'])}
                            </Badge>
                        )}
                        {Boolean(details.model_info['general.parameter_count']) && (
                            <Badge variant="outline" className="border-primary/20 text-[10px]">
                                Parameters: {(Number(details.model_info['general.parameter_count']) / 1e9).toFixed(1)}B
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            <div className="pt-2 border-t border-border/30 flex justify-end">
                <DialogPrimitive.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogPrimitive.Trigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1.5 font-semibold bg-background/50 hover:bg-background">
                            <TerminalIcon className="w-3 h-3" /> View Modelfile & License
                        </Button>
                    </DialogPrimitive.Trigger>

                    <AnimatePresence>
                        {isModalOpen && (
                            <DialogPrimitive.Portal forceMount>
                                <DialogPrimitive.Overlay asChild forceMount>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                                    />
                                </DialogPrimitive.Overlay>
                                <DialogPrimitive.Content asChild forceMount>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: "-50%", x: "-50%" }}
                                        animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
                                        exit={{ opacity: 0, scale: 0.95, y: "-50%", x: "-50%" }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="bg-background fixed top-[50%] left-[50%] z-50 flex flex-col w-[95vw] sm:max-w-[85vw] max-h-[90vh] rounded-xl border border-border/40 shadow-2xl outline-none overflow-hidden"
                                    >
                                        <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/20 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <TerminalIcon className="w-5 h-5 text-primary" />
                                                <h2 className="text-xl font-bold">
                                                    Model Specification: <span className="text-primary">{details.details.family}</span>
                                                </h2>
                                            </div>

                                            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring hover:bg-accent hover:text-accent-foreground rounded-full opacity-70 transition-all hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none p-2 border border-border/50 bg-background/50">
                                                <XIcon className="h-4 w-4" />
                                                <span className="sr-only">Close</span>
                                            </DialogPrimitive.Close>
                                        </div>

                                        <ScrollArea className="flex-1 overflow-y-auto w-full">
                                            <div className="flex flex-col p-8 gap-10 pb-16 w-full max-w-full">
                                                {/* Modelfile Section */}
                                                <div className="space-y-4 w-full">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
                                                        <FileTextIcon className="w-4 h-4 text-primary" /> Modelfile
                                                    </div>
                                                    <div className="rounded-xl border border-border/60 bg-black/40 p-6 relative group w-full overflow-hidden">
                                                        <pre className="text-sm font-mono text-blue-400 whitespace-pre-wrap break-all leading-relaxed selection:bg-primary/30 w-full">
                                                            {details.modelfile || 'No modelfile available.'}
                                                        </pre>
                                                    </div>
                                                </div>

                                                {/* License Section */}
                                                <div className="space-y-4 w-full">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
                                                        <InfoIcon className="w-4 h-4 text-primary" /> License Information
                                                    </div>
                                                    <div className="rounded-xl border border-border/60 bg-muted/30 p-6 w-full">
                                                        <div className="text-sm text-muted-foreground leading-loose selection:bg-primary/20 whitespace-pre-wrap w-full font-serif">
                                                            {details.license || 'No license specified.'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </motion.div>
                                </DialogPrimitive.Content>
                            </DialogPrimitive.Portal>
                        )}
                    </AnimatePresence>
                </DialogPrimitive.Root>
            </div>
        </div>
    )
}

type ModelWithDetails = OllamaModel & { extendedDetails?: ModelDetails }

const Home = () => {
    const navigate = useNavigate()
    const [models, setModels] = useState<ModelWithDetails[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(true)

    const [workers, setWorkers] = useState<string>('5')
    const [selectedModel, setSelectedModel] = useState<string>('')

    useEffect(() => {
        let mounted = true
        const fetchModels = async () => {
            try {
                const fetched = await listModels()
                if (mounted) {
                    // Fetch extended details for all models in parallel
                    const withDetails: ModelWithDetails[] = await Promise.all(
                        fetched.map(async (m) => {
                            try {
                                const details = await showModel(m.name)
                                return { ...m, extendedDetails: details }
                            } catch (e) {
                                console.warn(`Failed to fetch details for ${m.name}:`, e)
                                return m
                            }
                        })
                    )

                    setModels(withDetails)
                    if (withDetails.length > 0) {
                        setSelectedModel(withDetails[0].name)
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
                                            max="15"
                                            value={workers}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    setWorkers('');
                                                    return;
                                                }
                                                const num = parseInt(val);
                                                if (!isNaN(num)) {
                                                    setWorkers(Math.min(15, Math.max(0, num)).toString());
                                                }
                                            }}
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
                                            <SelectTrigger className="bg-muted/50 border-border/50 h-auto min-h-16 py-5 text-base px-4 [&>span]:line-clamp-none w-full">
                                                <div className="flex items-center gap-3 w-full text-left">
                                                    <CpuIcon className="w-4 h-4 text-primary shrink-0" />
                                                    <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select a model"} />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[400px]">
                                                {models.map(m => (
                                                    <SelectItem key={m.name} value={m.name} className="py-3 cursor-pointer">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className="font-bold text-foreground leading-none">{m.name}</span>
                                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                                <span className="bg-muted-foreground/10 px-1.5 py-0.5 rounded">{(m.size / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                                                                <span className="bg-muted-foreground/10 px-1.5 py-0.5 rounded">{m.details.parameter_size}</span>
                                                            </div>
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
                                            {model.extendedDetails ? (
                                                <ModelDetailsView details={model.extendedDetails} />
                                            ) : (
                                                <div className="p-4 text-sm text-destructive">Metadata unavailable.</div>
                                            )}
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