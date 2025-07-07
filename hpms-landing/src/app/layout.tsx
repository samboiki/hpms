import type { Metadata } from "next";
import { Montserrat, Poppins, Lexend, Rubik } from "next/font/google";
import "@/lib/env-polyfill"; // Import environment polyfill before anything else
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NewCharm Dental Practice | Dentist in Windhoek, Namibia",
  description: "NewCharm Dental Practice offers comprehensive dental care in Windhoek. From teeth whitening to implants, our expert team provides gentle, modern dentistry. Book today!",
  keywords: "dentist windhoek, dental practice namibia, teeth whitening windhoek, dental implants namibia, newcharm dental",
  openGraph: {
    title: "NewCharm Dental Practice - Premier Dental Care in Windhoek",
    description: "Experience exceptional dental care with our expert team. Comprehensive services from cleanings to cosmetic dentistry.",
    url: "https://www.newcharmdentalpractice.com",
    siteName: "NewCharm Dental Practice",
    locale: "en_NA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NewCharm Dental Practice",
    description: "Premier dental care in Windhoek, Namibia",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "https://www.newcharmdentalpractice.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="/env-init.js" />
      </head>
      <body
        className={`${montserrat.variable} ${poppins.variable} ${lexend.variable} ${rubik.variable} font-montserrat antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
