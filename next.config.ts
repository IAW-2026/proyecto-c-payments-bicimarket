import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.mercadopago.com https://secure.mlstatic.com;
  style-src 'self' 'unsafe-inline' https://sdk.mercadopago.com;
  frame-src https://www.mercadopago.com.ar https://www.mercadopago.com https://sandbox.mercadopago.com.ar https://sandbox.mercadopago.com;
  img-src 'self' data: blob: https://secure.mlstatic.com;
  connect-src 'self' https://api.mercadopago.com;
  font-src 'self' data:;
`;

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/*": ["./src/generated/prisma/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
