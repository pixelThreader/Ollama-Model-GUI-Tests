import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'

const Layout = () => {
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <header className="border-b bg-background z-50 shrink-0">
                <div className="container mx-auto px-4 h-14 flex items-center gap-6">
                    {/* Nav links */}
                    <Link
                        to="/"
                        className="font-semibold [&.active]:text-primary transition-colors hover:text-primary"
                    >
                        Home
                    </Link>
                    <Link
                        to="/chat"
                        className="font-semibold [&.active]:text-primary transition-colors hover:text-primary"
                    >
                        Chat
                    </Link>
                    <Link
                        to="/benchmark"
                        className="font-semibold [&.active]:text-primary transition-colors hover:text-primary"
                    >
                        Benchmark
                    </Link>

                    {/* Push toggle to the right */}
                    <div className="ml-auto">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* The main area must be positioned relative to allow absolute children like Chat overflow */}
            <main className="flex-1 relative overflow-hidden">
                <Outlet />
            </main>
        </div>
    )
}

export const Route = createRootRoute({
    component: Layout,
})

export default Layout