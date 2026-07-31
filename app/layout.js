import './globals.css' // <-- ¡Aquí en la primera línea!

export const metadata = {
  title: 'TPV Bar',
  description: 'Sistema de gestión para bar',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
