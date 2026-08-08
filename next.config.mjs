/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse and mammoth are CommonJS libraries that touch the filesystem at
  // require-time. They must stay external to the server bundle.
  serverExternalPackages: ['pdf-parse', 'mammoth', 'tesseract.js'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
