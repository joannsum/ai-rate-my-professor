/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        PINECONE_API_KEY: process.env.PINECONE_API_KEY,
        PINECONE_ENVIRONMENT:process.env.PINECONE_ENVIRONMENT,
    }
};

export default nextConfig;
