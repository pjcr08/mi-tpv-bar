'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])
  const [ticket, setTicket] = useState([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState(1)
  const [zonaSeleccionada, setZonaSeleccionada] = useState('Terraza')

  // Cargar productos al iniciar
  useEffect(() => {
    cargarProductos()
  }, [])

  const cargarProductos = async () => {
    const { data } = await supabase.from('productos').select('*')
    if (data) {
      setProductos(data)
      const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)
      setFamilias(fams)
      if (fams.length > 0) setFamiliaActiva(fams[0])
    }
  }

  // Añadir producto al ticket
  const agregarAlTicket = (prod) => {
    const existe = ticket.find((item) => item.id === prod.id)
    if (existe) {
      setTicket(
        ticket.map((item) =>
          item.id === prod.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      )
    } else {
      setTicket([...ticket, { ...prod, cantidad: 1 }])
    }
  }

  // Quitar producto o reducir cantidad
  const reducirDelTicket = (id) => {
    setTicket(
      ticket
        .map((item) => (item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item))
        .filter((item) => item.cantidad > 0)
    )
  }

  const calcularTotal = () => {
    return ticket.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  }

  const cobrar = async () => {
    if (ticket.length === 0) return

    // Impresión térmica
    window.print()

    // Guardar pedido en Supabase
    const { data: pedido } = await supabase
      .from('pedidos')
      .insert([{ mesa_id: mesaSeleccionada, estado: 'cobrado' }])
      .select()
      .single()

    if (pedido) {
      const lineas = ticket.map((item) => ({
        pedido_id: pedido.id,
        producto_nombre: item.nombre,
        precio: item.precio,
        cantidad: item.cantidad,
        destino: item.destino || 'barra',
        estado: 'sirviendo',
      }))
      await supabase.from('lineas_pedido').insert(lineas)
    }

    setTicket([])
    alert('¡Cobro realizado con éxito!')
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)

  // Colores dinámicos para las familias de productos
  const colores = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-purple-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-indigo-600',
  ]

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-impresion, #ticket-impresion * { visibility: visible; }
          #ticket-impresion { position: absolute; left: 0; top: 0; width: 80mm; color: #000; background: #fff; padding: 10px; font-family: monospace; }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row h-screen overflow-hidden font-sans">
        
        {/* COLUMNA IZQUIERDA: TICKET Y COBRO */}
        <div className="w-full md:w-1/3 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 no-imprimir">
          <div>
            {/* Control de Mesa */}
            <div className="bg-slate-800 p-3 rounded-xl mb-4 border border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-400 block font-bold uppercase">Mesa Seleccionada</span>
                <span className="text-xl font-black text-amber-400">
                  Mesa {mesaSeleccionada} ({zonaSeleccionada})
                </span>
              </div>
              <select
                value={mesaSeleccionada}
                onChange={(e) => setMesaSeleccionada(Number(e.target.value))}
                className="bg-slate-900 text-white p-2 rounded-lg border border-slate-700 text-sm font-bold"
              >
                {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    Mesa {num}
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket Visible */}
            <div id="ticket-impresion" className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 max-h-[50vh] overflow-y-auto">
              <h3 className="text-sm font-bold border-b border-slate-800 pb-2 mb-2 text-slate-400">
                CONSUMICIONES
              </h3>
              {ticket.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  Pulsa en los productos de la derecha para marcarlos.
                </p>
              ) : (
                <div className="space-y-2">
                  {ticket.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-800/50 pb-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => reducirDelTicket(item.id)}
                          className="w-5 h-5 bg-red-800 hover:bg-red-700 rounded text-xs font-black flex items-center justify-center text-white"
                        >
                          -
                        </button>
                        <span>
                          <strong className="text-amber-400 mr-1">{item.cantidad}x</strong>
                          {item.nombre}
                        </span>
                      </div>
                      <span className="font-bold">{(item.precio * item.cantidad).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Total y Botón Cobrar */}
          <div className="border-t border-slate-800 pt-4 mt-2">
            <div className="flex justify-between text-3xl font-black text-amber-400 mb-4">
              <span>TOTAL:</span>
              <span>{calcularTotal().toFixed(2)}€</span>
            </div>
            <button
              onClick={cobrar}
              disabled={ticket.length === 0}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xl rounded-xl uppercase transition shadow-lg"
            >
              💳 COBRAR E IMPRIMIR
            </button>
          </div>
        </div>

        {/* COLUMNA DERECHA: SELECCIÓN TÁCTIL DE PRODUCTOS */}
        <div className="w-full md:w-2/3 p-4 flex flex-col justify-between no-imprimir">
          
          {/* Botones de Familias */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {familias.map((f, idx) => (
              <button
                key={f}
                onClick={() => setFamiliaActiva(f)}
                className={`p-3 rounded-xl font-extrabold text-xs uppercase transition shadow-md ${
                  colores[idx % colores.length]
                } ${familiaActiva === f ? 'ring-4 ring-white scale-105' : 'opacity-80 hover:opacity-100'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Grid de Productos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto max-h-[75vh] pr-1">
            {productosFiltrados.map((p) => (
              <button
                key={p.id}
                onClick={() => agregarAlTicket(p)}
                className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-2xl text-left flex flex-col justify-between h-28 active:scale-95 transition shadow-lg"
              >
                <span className="font-bold text-base leading-snug">{p.nombre}</span>
                <span className="text-amber-400 font-black text-lg">{p.precio.toFixed(2)}€</span>
              </button>
            ))}
          </div>

        </div>

      </div>
    </>
  )
}
