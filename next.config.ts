import type { NextConfig } from "next";

// En producción, frontend y backend deben servirse detrás del mismo origen
// (GUIA_FLUJO_DATOS.md asume rutas relativas). En desarrollo, next dev y el
// backend Spring corren en puertos distintos, así que se reescribe aquí.
// Cambia BACKEND_ORIGIN si tu backend no está en localhost:8080.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8080";

// EXPORTAR=1 genera una exportación estática en out/ para servirla con Nginx,
// que es quien reenvía /api/ y /ws/ al backend. Sin servidor Next no hay
// reescrituras ni optimización de imágenes.
const EXPORTAR = process.env.EXPORTAR === "1";

const nextConfig: NextConfig = EXPORTAR
  ? {
      output: "export",
      images: { unoptimized: true },
    }
  : {
      async rewrites() {
        return [
          { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
          { source: "/ws/:path*", destination: `${BACKEND_ORIGIN}/ws/:path*` },
        ];
      },
    };

export default nextConfig;
