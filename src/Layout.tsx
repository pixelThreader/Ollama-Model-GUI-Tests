import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'


const Layout = () => {
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <header className="border-b bg-accent z-50 shrink-0">
                <div className="container mx-auto px-4 h-14 flex items-center">
                    {/* Brand */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-auto">
                        <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
                        <span className="font-bold text-sm text-foreground tracking-tight hidden sm:inline">
                            System Stress Tester <span className="text-muted-foreground font-medium">with Ollama</span>
                        </span>
                    </Link>

                    {/* Centered Nav Links */}
                    <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
                        <Link
                            to="/"
                            className="font-semibold text-sm [&.active]:text-primary transition-colors hover:text-primary"
                        >
                            Home
                        </Link>
                        <Link
                            to="/chat"
                            className="font-semibold text-sm [&.active]:text-primary transition-colors hover:text-primary"
                        >
                            Chat
                        </Link>
                    </nav>

                    {/* Theme Toggle */}
                    <div className="ml-auto">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* The main area must be positioned relative to allow absolute children like Chat overflow */}
            <main className="flex-1 relative overflow-hidden">
                <Outlet />
            </main>
            <Toaster richColors position="top-right" />
        </div>
    )
}

export const Route = createRootRoute({
    component: Layout,
})

export default Layout