import {
    rootRoute,
    route,
    index,
} from '@tanstack/virtual-file-routes'

export const routes = rootRoute('Layout.tsx', [
    index('pages/Home.tsx'),
    route('/chat', 'pages/Chat.tsx'),
])
