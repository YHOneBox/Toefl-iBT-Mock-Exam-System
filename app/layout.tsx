import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { BASE_PATH } from "@/lib/base-path";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOEFL iBT Mock",
  description: "Local self-use mock of the enhanced TOEFL iBT exam",
  icons: {
    icon: [{ url: `${BASE_PATH}/logo.png?v=2`, type: "image/png" }],
    apple: [{ url: `${BASE_PATH}/logo.png?v=2`, type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
