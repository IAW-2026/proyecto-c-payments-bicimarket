import type { NextConfig } from "next";

const CLERK_DOMAIN = 'https://*.clerk.accounts.dev'
const CLERK_IMG = 'https://img.clerk.com'

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' ${CLERK_DOMAIN} https://sdk.mercadopago.com https://secure.mlstatic.com https://www.mercadopago.com.ar https://sandbox.mercadopago.com.ar https://www.mercadopago.com https://sandbox.mercadopago.com;
  style-src 'self' 'unsafe-inline' ${CLERK_DOMAIN} https://sdk.mercadopago.com https://www.mercadopago.com.ar https://sandbox.mercadopago.com.ar https://www.mercadopago.com https://sandbox.mercadopago.com;
  frame-src ${CLERK_DOMAIN} https://www.mercadopago.com.ar https://www.mercadopago.com https://sandbox.mercadopago.com.ar https://sandbox.mercadopago.com https://www.mercadopago.com.br https://api.mercadopago.com;
  img-src 'self' data: blob: ${CLERK_DOMAIN} ${CLERK_IMG} https://secure.mlstatic.com https://www.mercadopago.com.ar https://sandbox.mercadopago.com.ar https://www.mercadopago.com https://sandbox.mercadopago.com;
  connect-src 'self' ${CLERK_DOMAIN} https://api.mercadopago.com https://www.mercadopago.com.ar https://sandbox.mercadopago.com.ar https://www.mercadopago.com https://sandbox.mercadopago.com;
  font-src 'self' data: ${CLERK_DOMAIN} https://sdk.mercadopago.com;
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
