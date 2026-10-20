import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Control de Nombramientos | Panel de control",
  description: "Panel de control para la gestión institucional de nombramientos.",
};

/** Define el idioma, tipografía y estilos compartidos por todas las rutas. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={cn("h-full", "antialiased", geistSans.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
