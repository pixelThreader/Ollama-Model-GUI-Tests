import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRef, useSyncExternalStore } from 'react'

// Subscribes to nothing — just returns rerender count on client so we can
// detect whether we're on the server (no subscribe = always returns snapshot).
function useIsMounted() {
    const ref = useRef(false)
    return useSyncExternalStore(
        (cb) => {
            ref.current = true
            // No actual external store — call immediately to force one re-render.
            cb()
            return () => { }
        },
        () => ref.current,   // client snapshot
        () => false,          // server snapshot (always false = not mounted)
    )
}

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const mounted = useIsMounted()

    if (!mounted) return <div className="h-9 w-9" />

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
            {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
            ) : (
                <Moon className="h-4 w-4" />
            )}
        </Button>
    )
}
