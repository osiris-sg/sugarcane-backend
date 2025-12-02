export const metadata = {
  title: 'Sugarcane Backend',
  description: 'Backend API for Sugarcane Vending Machine',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
