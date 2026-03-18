import "./globals.css";

export const metadata = {
  title: "Resume Interview Agent",
  description: "Analyze resumes against job descriptions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}