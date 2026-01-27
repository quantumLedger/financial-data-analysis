/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly ensure PostCSS is configured
  experimental: {
    // This ensures PostCSS config is loaded
  },
};

export default nextConfig;
