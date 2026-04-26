import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClassroomProvider } from "@/contexts/ClassroomContext";
import { AlertProvider } from "@/contexts/AlertContext";
import GlobalClassroom from "@/components/GlobalClassroom";
import QueryProvider from "@/components/providers/QueryProvider";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--font-dm-sans" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif" });

export const metadata: Metadata = {
  title: "Podium - Elevate Your Learning",
  description: "The premium virtual classroom platform for modern education in Ghana.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmSerif.variable} font-sans`} suppressHydrationWarning>
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
