import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClassroomProvider } from "@/contexts/ClassroomContext";
import { AlertProvider } from "@/contexts/AlertContext";
import GlobalClassroom from "@/components/GlobalClassroom";
import QueryProvider from "@/components/providers/QueryProvider";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} font-sans`} suppressHydrationWarning>
        <QueryProvider>
          <AlertProvider>
            <AuthProvider>
              <ClassroomProvider>
                {children}
                <GlobalClassroom />
              </ClassroomProvider>
            </AuthProvider>
          </AlertProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
