import type { NextConfig } from "next";

const securityHeaders = [
  // Block the page from being embedded in iframes (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer info only within same origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Force HTTPS for 1 year
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Content Security Policy — admin panel, no third-party embeds needed
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Allow inline styles (needed by Tailwind/shadcn) and external fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Font files from Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com",
      // Scripts: self + nonce-based inline (Next.js injects inline scripts)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // API calls: self + Holded + Vercel Blob
      "connect-src 'self' https://api.holded.com https://*.public.blob.vercel-storage.com wss:",
      // Images: self + Vercel Blob + data URIs
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
