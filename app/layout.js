import "./globals.css";

export const metadata = {
  title: "Justalk — Just you. Justalk.",
  description:
    "Justalk, le réseau social 100% biométrique. Connecte-toi avec ton visage, pas avec un mot de passe.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Justalk",
  },
};

export const viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // gère l'encoche iPhone avec safe-area-inset
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg">{children}</body>
    </html>
  );
}
