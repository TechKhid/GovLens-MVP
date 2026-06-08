/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        webpackBuildWorker: false,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'upload.wikimedia.org',
                pathname: '/wikipedia/commons/**',
            },
            {
                protocol: 'https',
                hostname: 'encrypted-tbn0.gstatic.com',
                pathname: '/images/**',
            },
        ],
    },
};

export default nextConfig;
