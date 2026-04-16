import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    experimental: {},
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'hauxhaux.com.br' },
        ],
    },
}

export default nextConfig
