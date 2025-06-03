import {Inter} from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Header from "@/components/header";
import { ClerkProvider } from "@clerk/nextjs";

const inter=Inter({subsets:["latin"]}); //only includes Latin character sets

export const metadata = {
  title: "FinPlan",
  description: "One Stop Finance Platform",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className}`}>
          {/*header*/}
          <Header/>
          <main className="min-h-screen">{children}</main>
          <Toaster richColors/>
          {/*footer*/}
          <footer className="bg-blue-50 py-12">
            <div className="container mx-auto px-4 text-center text-gray-600">
              <p>Made with 💙 by ghadir </p>
            </div>
          </footer>
          </body>
      </html>
    </ClerkProvider>
  );
}