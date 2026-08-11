import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acuario NFC",
  description: "Registro y mantenimiento inteligente para tu acuario.",
  applicationName: "Acuario NFC",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Acuario NFC",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d3033",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
