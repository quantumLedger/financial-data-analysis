import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { BASE_URL } from "@/lib/config";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finance @weidentify.ai | Financial Data Analysis",
  description: "AI-powered financial assistant for portfolio analysis and data visualization. Powered by weidentify.ai and inspolio. Advanced portfolio management and investment insights.",
  keywords: [
    "finance",
    "financial analysis",
    "portfolio analysis",
    "AI assistant",
    "weidentify.ai",
    "inspolio",
    "investment analysis",
    "financial data",
    "portfolio management",
    "investment insights",
    "financial visualization"
  ],
  authors: [{ name: "weidentify.ai" }],
  creator: "weidentify.ai",
  publisher: "weidentify.ai",
  applicationName: "Finance @weidentify.ai",
  category: "Finance",
  openGraph: {
    title: "Finance @weidentify.ai | Financial Data Analysis",
    description: "AI-powered financial assistant for portfolio analysis and data visualization. Powered by weidentify.ai and inspolio.",
    type: "website",
    siteName: "Finance @weidentify.ai",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finance @weidentify.ai | Financial Data Analysis",
    description: "AI-powered financial assistant for portfolio analysis and data visualization. Powered by weidentify.ai and inspolio.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  metadataBase: new URL(BASE_URL),
  icons: {
    icon: "/ant-logo.svg",
    shortcut: "/ant-logo.svg",
  },
  alternates: {
    canonical: "/",
  },
  other: {
    "weidentify.ai": "Financial AI Platform",
    "inspolio": "Investment Portfolio Management",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
