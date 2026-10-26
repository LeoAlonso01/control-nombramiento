import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Nombramientos | Panel de control",
  description: "Panel de control para la gestión institucional de nombramientos.",
};

/** Define el idioma, tipografía y estilos compartidos por todas las rutas. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
