import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Nombramientos",
  description: "Sistema institucional para la gestión de nombramientos y declaraciones.",
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
