import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: { default: "KindBox", template: "%s · KindBox" },
  description: "Plataforma de monitoreo logístico y simulación de operaciones de KindBox.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${plex.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
