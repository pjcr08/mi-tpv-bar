export const metadata = {
  title: 'TPV Bar',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* Carga Tailwind CSS directamente por CDN sin depender del compilador */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-slate-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
