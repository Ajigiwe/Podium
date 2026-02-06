import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ClassroomProvider } from "@/contexts/ClassroomContext";
import { AlertProvider } from "@/contexts/AlertContext";
import GlobalClassroom from "@/components/GlobalClassroom";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Podium - Elevate Your Learning",
  description: "The premium virtual classroom platform for modern education in Ghana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AlertProvider>
            <AuthProvider>
              <ClassroomProvider>
                {children}
                <GlobalClassroom />
              </ClassroomProvider>
            </AuthProvider>
          </AlertProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
