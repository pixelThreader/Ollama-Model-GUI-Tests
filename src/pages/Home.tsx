import { createFileRoute } from '@tanstack/react-router'

const Home = () => {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Home</h1>
            <p>Welcome to the Ollama Model GUI Tests.</p>
        </div>
    )
}

export const Route = createFileRoute('/')({
    component: Home,
})

export default Home