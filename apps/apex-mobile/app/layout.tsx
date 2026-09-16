import type { Metadata, Viewport } from "next";
import { Chakra_Petch } from "next/font/google";
import { ConnectionProvider } from "@/components/ConnectionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import SettingsPanel from "@/components/SettingsPanel";
import "./globals.css";

// Fuente condensada tipo racing HUD para los valores numéricos críticos de
// la Pantalla_Principal (Requisito 11.3). Se reutiliza la misma fuente que
// apps/dashboard (Chakra Petch vía next/font/google) para mantener
// coherencia visual entre ambas apps del producto, expuesta como CSS
// variable `--font-hud` referenciada desde la utilidad `.hud-number` en
// globals.css. Fallback a una pila de fuentes condensadas/monoespaciadas
// del sistema si la fuente de Google no está disponible.
const chakraPetch = Chakra_Petch({
  variable: "--font-hud",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Apex Mobile",
  description: "Apex Mobile: pantalla única de telemetría en vivo de iRacing para el piloto",
};

// Requisito 11.1/11.4: pantalla única sin scroll, pensada para leerse a
// distancia mientras se conduce. `viewportFit: "cover"` permite ocupar
// también las áreas de "safe area" en dispositivos con notch, y
// `themeColor` tiñe la barra de estado/UI del navegador con el fondo casi
// negro del tema para reforzar la estética de HUD oscuro.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${chakraPetch.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider>
          <ConnectionProvider>
            {children}
            <SettingsPanel />
          </ConnectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
