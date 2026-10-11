import './globals.css';

export const metadata = { title: 'LicenseLedger', description: 'SaaS asset and software license tracker' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
