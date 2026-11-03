import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Developer portfolio", description: "Selected projects" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
