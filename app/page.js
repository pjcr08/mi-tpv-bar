'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])
  const [ticket, setTicket] = useState([])
  
  // Selección de Mesa
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // Teclado numérico / Unidades
  const [multiplicador, setMultiplicador] = useState(1)

  useEffect(() => {
    cargarProductos()
  }, [])

  const cargarProductos = async () => {
    const { data } = await supabase.from('productos').select('*')
    if (data && data.length > 0) {
      setProductos(data)
      const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)
      setFamilias(fams)
      if (fams.length > 0) setFamiliaActiva(fams[0])
    }
  }

  // Lógica de adición al ticket respetando el multiplicador
  const agregarAlTicket = (prod) => {
    const cantAgregar = multiplicador > 0 ? multiplicador : 1
    const existe = ticket.find((item) => item.id === prod.id)

    if (existe) {
      setTicket(
        ticket.map((item) =>
          item.id === prod.id
            ? { ...item, cantidad: item.cantidad + cantAgregar }
            : item
        )
      )
    } else {
      setTicket([...ticket, { ...prod, cantidad: cantAgregar }])
    }

    // Resetear el teclado numérico a 1
    setMultiplicador(1)
  }

  const cambiarCantidadItem = (id, delta) => {
    setTicket(
      ticket
        .map((item) =>
          item.id === id ? { ...item, cantidad: item.cantidad + delta } : item
        )
        .filter((item) => item.cantidad > 0)
    )
  }

  const calcularTotal = () => {
    return ticket.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)
  }

  const presionarTeclado = (num) => {
    if (num === 'C') {
      setMultiplicador(1)
    } else {
      const nuevoVal = multiplicador === 1 ? String(num) : String(multiplicador) + String(num)
      setMultiplicador(Number(nuevoVal))
    }
  }

  const cobrarEImprimir = async () => {
    if (ticket.length === 0) return

    try {
      window.print()

      // Buscar ID de mesa
      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('numero', mesaNum)
        .eq('zona', zonaActiva)
        .maybeSingle()

      const mesaId = mesaBD ? mesaBD.id : 1

      const { data: pedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'cobrado' }])
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
      setMultiplicador(1)
      alert('¡Cobro realizado con éxito!')
    } catch (err) {
      console.error(err)
      alert('Error procesando cobro')
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)

  // Rangos de mesas según zona
  const rangosZona = {
    Terraza: { min: 1, max: 20 },
    Salón: { min: 21, max: 40 },
    Barra: { min: 41, max: 60 },
  }

  const opcionesMesas = []
  const { min, max } = rangosZona[zonaActiva] || { min: 1, max: 20 }
  for (let i = min; i <= max; i++) {
    opcionesMesas.push(i)
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-print, #ticket-print * { visibility: visible; }
          #ticket-print {
            position: absolute; left: 0; top: 0; width: 80mm;
            color: #000 !important; background: #fff !important;
            padding: 10px; font-family: monospace;
          }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      {/* Carga CDN de Tailwind de respaldo */}
      <script src="https://cdn.tailwindcss.com"></script>

      <div className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row h-screen overflow-hidden font-sans no-imprimir select-none">
        
        {/* ================= SECCIÓN IZQUIERDA: TICKET Y TECLADO ================= */}
        <div className="w-full lg:w-5/12 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-3">
          
          {/* Header de Zona y Mesa */}
          <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center mb-2">
            <div className="flex gap-1">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZonaActiva(z)
                    setMesaNum(rangosZona[z].min)
                  }}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${
                    zonaActiva === z
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">MESA:</span>
              <select
                value={mesaNum}
                onChange={(e) => setMesaNum(Number(e.target.value))}
                className="bg-slate-950 text-amber-400 font-black px-3 py-1.5 rounded-lg border border-slate-700 text-base"
              >
                {opcionesMesas.map((n) => (
                  <option key={n} value={n}>
                    Mesa {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visor de Ticket */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex-1 overflow-y-auto mb-2 min-h-[180px]">
            <div className="flex justify-between text-xs font-bold border-b border-slate-800 pb-1 mb-2 text-slate-400 uppercase">
              <span>Producto</span>
              <span>Cant / Total</span>
            </div>

            {ticket.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                Selecciona productos a la derecha para añadir al ticket
              </div>
            ) : (
              <div className="space-y-1.5">
                {ticket.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-sm border-b border-slate-800/40 pb-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => cambiarCantidadItem(item.id, -1)}
                        className="w-5 h-5 bg-red-900 hover:bg-red-700 rounded text-xs font-black flex items-center justify-center text-white"
                      >
                        -
                      </button>
                      <button
                        onClick={() => cambiarCantidadItem(item.id, 1)}
                        className="w-5 h-5 bg-emerald-900 hover:bg-emerald-700 rounded text-xs font-black flex items-center justify-center text-white"
                      >
                        +
                      </button>
                      <span className="font-medium text-slate-200">
                        {item.nombre}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-400 font-black mr-2">
                        {item.cantidad}x
                      </span>
                      <span className="font-bold">
                        {(Number(item.precio) * item.cantidad).toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teclado Numérico + Totales */}
          <div className="grid grid-cols-4 gap-2 border-t border-slate-800 pt-2">
            {/* Multiplicador actual */}
            <div className="col-span-4 bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center px-3">
              <span className="text-xs text-slate-400 font-bold">MULTIPLICADOR / UNIDADES:</span>
              <span className="text-lg font-black text-amber-400">{multiplicador}x</span>
            </div>

            {/* Teclas numéricas */}
            {[1, 2, 3, 'C', 4, 5, 6, 0, 7, 8, 9].map((val) => (
              <button
                key={val}
                onClick={() => presionarTeclado(val)}
                className={`p-2.5 rounded-lg font-black text-lg transition active:scale-95 ${
                  val === 'C'
                    ? 'bg-rose-900/80 text-rose-200 border border-rose-700 hover:bg-rose-800'
                    : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {val}
              </button>
            ))}

            {/* Total acumulado */}
            <div className="col-span-1 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col justify-center items-center p-1 text-center">
              <span className="text-[10px] text-amber-400 font-bold uppercase">Total</span>
              <span className="text-lg font-black text-amber-400">
                {calcularTotal().toFixed(2)}€
              </span>
            </div>

            {/* Botón de Cobro Directo */}
            <button
              onClick={cobrarEImprimir}
              disabled={ticket.length === 0}
              className="col-span-4 mt-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black text-lg rounded-xl uppercase transition shadow-lg flex items-center justify-center gap-2"
            >
              💳 COBRAR E IMPRIMIR ({calcularTotal().toFixed(2)}€)
            </button>
          </div>
        </div>

        {/* ================= SECCIÓN DERECHA: BOTONERA DE PRODUCTOS ================= */}
        <div className="w-full lg:w-7/12 p-3 flex flex-col justify-between bg-slate-950">
          
          {/* Familias */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 mb-3">
            {familias.map((f, idx) => {
              const colores = [
                'bg-blue-600 border-blue-500',
                'bg-emerald-600 border-emerald-500',
                'bg-purple-600 border-purple-500',
                'bg-amber-600 border-amber-500',
                'bg-rose-600 border-rose-500',
                'bg-indigo-600 border-indigo-500',
              ]
              const estiloColor = colores[idx % colores.length]
              const esActiva = familiaActiva === f

              return (
                <button
                  key={f}
                  onClick={() => setFamiliaActiva(f)}
                  className={`p-2.5 rounded-xl font-black text-xs uppercase border transition shadow-md truncate ${estiloColor} ${
                    esActiva
                      ? 'ring-2 ring-white scale-[1.02] opacity-100'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {f}
                </button>
              )
            })}
          </div>

          {/* Grid Táctil de Productos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 overflow-y-auto max-h-[78vh] pr-1 flex-1">
            {productosFiltrados.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-600 font-medium">
                No hay productos en la familia "{familiaActiva}".
              </div>
            ) : (
              productosFiltrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregarAlTicket(p)}
                  className="p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left flex flex-col justify-between h-28 active:scale-95 transition shadow-lg group"
                >
                  <span className="font-bold text-sm leading-snug text-slate-200 group-hover:text-amber-400 transition">
                    {p.nombre}
                  </span>
                  <div className="flex justify-between items-end border-t border-slate-800/80 pt-2">
                    <span className="text-xs text-slate-500 uppercase font-semibold">
                      {p.destino || 'Barra'}
                    </span>
                    <span className="text-amber-400 font-black text-base">
                      {Number(p.precio).toFixed(2)}€
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

        </div>
      </div>

      {/* Ticket Oculto para Impresión Térmica */}
      <div id="ticket-print">
        <h2 style={{ textAlign: 'center', margin: '0 0 10px 0' }}>TICKET DE COBRA</h2>
        <p>
          <strong>Zona:</strong> {zonaActiva} | <strong>Mesa:</strong> {mesaNum}
        </p>
        <hr />
        {ticket.map((item) => (
          <div
            key={item.id}
            style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}
          >
            <span>
              {item.cantidad}x {item.nombre}
            </span>
            <span>{(Number(item.precio) * item.cantidad).toFixed(2)}€</span>
          </div>
        ))}
        <hr />
        <h3 style={{ textAlign: 'right', marginTop: '10px' }}>
          TOTAL: {calcularTotal().toFixed(2)}€
        </h3>
      </div>
    </>
  )
}
