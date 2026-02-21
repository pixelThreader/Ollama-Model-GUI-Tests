import React from 'react'
import { createFileRoute } from '@tanstack/react-router'

const Benchmark = () => {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Benchmark</h1>
            <p>Performance testing results will be built here.</p>
        </div>
    )
}

export const Route = createFileRoute('/benchmark')({
    component: Benchmark,
})

export default Benchmark