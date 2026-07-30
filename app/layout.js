export const metadata = {
  title: 'Mi TPV Bar',
  description: 'Aplicación TPV para bar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
