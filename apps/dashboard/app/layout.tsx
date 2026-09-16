import type { Metadata } from "next";
import { Geist, Geist_Mono, Chakra_Petch } from "next/font/google";
import { ConnectionProvider } from "@/components/ConnectionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fuente condensada tipo racing HUD para los valores numéricos de telemetría
// y clasificación (Requisito 16.3). Chakra Petch tiene un corte angular y
// condensado que encaja con la estética de broadcast de motorsport/e-sports.
// Se usa como CSS variable (--font-hud) referenciada desde la clase
// utilitaria `.hud-number` en globals.css, con fallback a una pila de
// fuentes condensadas del sistema si la fuente de Google no está disponible.
const chakraPetch = Chakra_Petch({
  variable: "--font-hud",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Apex Race Engineer Dashboard",
  description: "Race Engineer Dashboard con telemetría en vivo de iRacing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <ThemeProvider>
          <ConnectionProvider>{children}</ConnectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
