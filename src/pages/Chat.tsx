import React from 'react'
import { createFileRoute } from '@tanstack/react-router'

const Chat = () => {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Chat</h1>
            <p>Chat interface will be built here.</p>
        </div>
    )
}

export const Route = createFileRoute('/chat')({
    component: Chat,
})

export default Chat