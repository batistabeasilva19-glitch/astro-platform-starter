/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Uploads de imagens passam direto do navegador para o Supabase Storage,
    // mas o seed de demonstração roda em Server Action.
    serverActions: { bodySizeLimit: '8mb' },
  },
};
export default nextConfig;
