import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClassroomProvider } from "@/contexts/ClassroomContext";
import { AlertProvider } from "@/contexts/AlertContext";
import GlobalClassroom from "@/components/GlobalClassroom";
import QueryProvider from "@/components/providers/QueryProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import PwaSplash from "@/components/PwaSplash";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Podium - Elevate Your Learning",
  description: "The premium virtual classroom platform for modern education in Ghana.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Podium",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#1845D4",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')",
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} font-sans`}
        suppressHydrationWarning
      >
        <PwaSplash />
        <QueryProvider>
          <AlertProvider>
            <AuthProvider>
              <ClassroomProvider>
                {children}
                <GlobalClassroom />
                <PwaInstallPrompt />
              </ClassroomProvider>
            </AuthProvider>
          </AlertProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
