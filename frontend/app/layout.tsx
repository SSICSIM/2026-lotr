import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Matches font.family.body/heading ("Inter") from the Figma tokens.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  // Tab title is the committee name; pages with their own title show as
  // "<page> | <committee>".
  title: { default: "Lord of the Rings: The Shattered Fellowship", template: "%s | Lord of the Rings: The Shattered Fellowship" },
  description: "Lord of the Rings: The Shattered Fellowship crisis staff workspace.",
  icons: { icon: "/favicon.png", apple: "/favicon-apple.png" },
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="min-h-screen">
        <Providers>
          <TooltipProvider>
            <Navbar />
            {props.children}
            <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
