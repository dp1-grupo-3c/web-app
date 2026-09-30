import type { NextConfig } from "next";

// En producción, frontend y backend deben servirse detrás del mismo origen
// (GUIA_FLUJO_DATOS.md asume rutas relativas). En desarrollo, next dev y el
// backend Spring corren en puertos distintos, así que se reescribe aquí.
// Cambia BACKEND_ORIGIN si tu backend no está en localhost:8080.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: "/ws/:path*", destination: `${BACKEND_ORIGIN}/ws/:path*` },
    ];
  },
};

export default nextConfig;
