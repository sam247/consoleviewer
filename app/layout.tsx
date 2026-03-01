import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Consoleview – GSC Dashboard",
  description: "Minimal Google Search Console overview and drill-down",
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
            __html: `(function(){var t=localStorage.getItem("consoleview-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}else{document.documentElement.setAttribute("data-theme","light")}})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground flex flex-col">
        <Providers>
          <div className="flex flex-col flex-1 min-h-0">
            {children}
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
