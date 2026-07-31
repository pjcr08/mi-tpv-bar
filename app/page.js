'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Productos de prueba enriquecidos si Supabase está vacío o sin registros
const PRODUCTOS_EJEMPLO = [
  // CAFÉS
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra' },
  { id: 103, nombre: 'Café Jorco Especial', precio: 2.20, familia: 'Cafés', destino: 'barra' },
  { id: 104, nombre: 'Cortado', precio: 1.30, familia: 'Cafés', destino: 'barra' },
  { id: 105, nombre: 'Carajillo', precio: 2.00, familia: 'Cafés', destino: 'barra' },
  
  // BEBIDAS
  { id: 106, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra' },
  { id: 107, nombre: 'Refresco Cola', precio: 2.20, familia: 'Bebidas', destino: 'barra' },
  { id: 108, nombre: 'Agua 50cl', precio: 1.50, familia: 'Bebidas', destino: 'barra' },
  { id: 109, nombre: 'Cerveza 1/3 Tercio', precio: 2.80, familia: 'Bebidas', destino: 'barra' },
  { id: 110, nombre: 'Copa de Vino', precio: 3.00, familia: 'Bebidas', destino: 'barra' },

  // COMIDA
  { id: 111, nombre: 'Bocadillo Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina' },
  { id: 112, nombre: 'Ración Bravas', precio: 6.00, familia: 'Comida', destino: 'cocina' },
  { id: 113, nombre: 'Pincho de Tortilla', precio: 3.50, familia: 'Comida', destino: 'cocina' },
  { id: 114, nombre: 'Hamburguesa Jorco', precio: 8.50, familia: 'Comida', destino: 'cocina' },

  // POSTRES
  { id: 115, nombre: 'Tarta de Queso', precio: 4.00, familia: 'Postres', destino: 'cocina' },
  { id: 116, nombre: 'Flan Casero', precio: 3.50, familia: 'Postres', destino: 'cocina' },
  { id: 117, nombre: 'Helado 2 Bolas', precio: 3.00, familia: 'Postres', destino: 'cocina' },
]

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])

  // Selección de Mesa
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // ESTADO DE TICKETS POR MESA: { "Terraza-1": [ { id, nombre, precio, cantidad... } ], ... }
  const [ticketsPorMesa, setTicketsPorMesa] = useState({})

  // Teclado numérico / Unidades
  const [multiplicador, setMultiplicador] = useState(1)

  // Obtener la clave única de la mesa actual
  const claveMesaActual = `${zonaActiva}-${mesaNum}`
  // Ticket de la mesa actual
  const ticketActual = ticketsPorMesa[claveMesaActual] || []

  useEffect(() => {
    cargarProductos()
  }, [])

  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*')

      if (error || !data || data.length === 0) {
        usarProductosEjemplo()
        return
      }

      setProductos(data)
      const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)

      if (fams.length > 0) {
        setFamilias(fams)
        setFamiliaActiva(fams[0])
      } else {
        usarProductosEjemplo()
      }
    } catch {
      usarProductosEjemplo()
    }
  }

  const usarProductosEjemplo = () => {
    setProductos(PRODUCTOS_EJEMPLO)
    const fams = [...new Set(PRODUCTOS_EJEMPLO.map((p) => p.familia))]
    setFamilias(fams)
    setFamiliaActiva(fams[0])
  }

  // --- CONTROL DEL TICKET CON PERSISTENCIA ---
  const agregarAlTicket = (prod) => {
    const cantAgregar = multiplicador > 0 ? multiplicador : 1
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []
    const existe = ticketExistente.find((item) => item.id === prod.id)

    let nuevoTicket = []
    if (existe) {
      nuevoTicket = ticketExistente.map((item) =>
        item.id === prod.id
          ? { ...item, cantidad: item.cantidad + cantAgregar }
          : item
      )
    } else {
      nuevoTicket = [...ticketExistente, { ...prod, cantidad: cantAgregar }]
    }

    setTicketsPorMesa({
      ...ticketsPorMesa,
      [claveMesaActual]: nuevoTicket,
    })
    setMultiplicador(1)
  }

  const cambiarCantidadItem = (id, delta) => {
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []
    const nuevoTicket = ticketExistente
      .map((item) =>
        item.id === id ? { ...item, cantidad: item.cantidad + delta } : item
      )
      .filter((item) => item.cantidad > 0)

    setTicketsPorMesa({
      ...ticketsPorMesa,
      [claveMesaActual]: nuevoTicket,
    })
  }

  const calcularTotal = () => {
    return ticketActual.reduce(
      (sum, item) => sum + Number(item.precio) * item.cantidad,
      0
    )
  }

  const presionarTeclado = (num) => {
    if (num === 'C') {
      setMultiplicador(1)
    } else {
      const nuevoVal =
        multiplicador === 1 ? String(num) : String(multiplicador) + String(num)
      setMultiplicador(Number(nuevoVal))
    }
  }

  const obtenerOCrearMesa = async () => {
    try {
      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('numero', mesaNum)
        .eq('zona', zonaActiva)
        .maybeSingle()

      if (mesaBD) return mesaBD.id

      const { data: nuevaMesa } = await supabase
        .from('mesas')
        .insert([{ numero: mesaNum, zona: zonaActiva }])
        .select()
        .single()

      return nuevaMesa ? nuevaMesa.id : null
    } catch {
      return null
    }
  }

  const enviarComanda = async () => {
    if (ticketActual.length === 0) return

    try {
      const mesaId = await obtenerOCrearMesa()

      // 1. Insertar pedido usando 'abierto'
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'abierto' }])
        .select()
        .single()

      if (errPedido) {
        alert(`❌ Error en Pedidos: ${errPedido.message} (${errPedido.code || ''})`)
        return
      }

      // 2. Insertar líneas de pedido
      if (pedido) {
        const lineas = ticketActual.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'pendiente',
        }))

        const { error: errLineas } = await supabase.from('lineas_pedido').insert(lineas)

        if (errLineas) {
          alert(`❌ Error en Líneas: ${errLineas.message} (${errLineas.code || ''})`)
          return
        }
      }

      // Mantener comanda en pantalla para adiciones posteriores o resetear si prefieres
      setMultiplicador(1)
      alert(`📝 ¡Comanda enviada a Cocina/Barra para ${zonaActiva} - Mesa ${mesaNum}!`)
    } catch (err) {
      console.error(err)
      alert(`❌ Error inesperado: ${err.message || 'Error de red'}`)
    }
  }

  const cobrarEImprimir = async () => {
    if (ticketActual.length === 0) return

    try {
      window.print()

      const mesaId = await obtenerOCrearMesa()

      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'cobrado' }])
        .select()
        .single()

      if (pedido && !errPedido) {
        const lineas = ticketActual.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'cobrado',
        }))

        await supabase.from('lineas_pedido').insert(lineas)
      }

      // Limpiar solo la comanda de la mesa cobrada
      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)

      setMultiplicador(1)
      alert('💳 ¡Cobro realizado y mesa liberada con éxito!')
    } catch (err) {
      console.error(err)
      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)
      setMultiplicador(1)
      alert('Cobro registrado localmente')
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)

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

      {/* HEADER DE BRANDING */}
      <header className="bg-slate-950 border-b border-amber-500/40 px-6 py-2.5 flex justify-between items-center no-imprimir select-none">
        <h1 className="text-xl font-black text-amber-500 tracking-wider">
          ☕ JORCO FUSIÓN
        </h1>
        <span className="text-xs text-slate-400 font-bold">
          SISTEMA TPV DE BARRA
        </span>
      </header>

      <div className="min-h-[calc(100vh-49px)] bg-slate-950 text-white flex flex-col lg:flex-row h-full overflow-hidden font-sans no-imprimir select-none">
        
        {/* PANEL IZQUIERDO: TICKET Y TECLADO */}
        <div className="w-full lg:w-5/12 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-3">
          
          {/* SELECTOR DE ZONAS Y MESAS */}
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
                {opcionesMesas.map((n) => {
                  const clave = `${zonaActiva}-${n}`
                  const tieneItems = ticketsPorMesa[clave] && ticketsPorMesa[clave].length > 0
                  return (
                    <option key={n} value={n}>
                      Mesa {n} {tieneItems ? '🔴' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          {/* VISOR TICKET */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex-1 overflow-y-auto mb-2 min-h-[180px]">
            <div className="flex justify-between text-xs font-bold border-b border-slate-800 pb-1 mb-2 text-slate-400 uppercase">
              <span>Producto</span>
              <span>Cant / Total</span>
            </div>

            {ticketActual.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs italic py-8">
                Selecciona productos a la derecha para añadir a {zonaActiva} (Mesa {mesaNum})
              </div>
            ) : (
              <div className="space-y-1.5">
                {ticketActual.map((item) => (
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

          {/* TECLADO NUMÉRICO Y BOTONES ACCIÓN */}
          <div className="grid grid-cols-4 gap-2 border-t border-slate-800 pt-2">
            <div className="col-span-4 bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center px-3">
              <span className="text-xs text-slate-400 font-bold">UNIDADES / MULTIPLICADOR:</span>
              <span className="text-lg font-black text-amber-400">{multiplicador}x</span>
            </div>

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

            <div className="col-span-1 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col justify-center items-center p-1 text-center">
              <span className="text-[10px] text-amber-400 font-bold uppercase">Total</span>
              <span className="text-lg font-black text-amber-400">
                {calcularTotal().toFixed(2)}€
              </span>
            </div>

            {/* BOTÓN 1: ENVIAR COMANDA */}
            <button
              onClick={enviarComanda}
              disabled={ticketActual.length === 0}
              className="col-span-4 mt-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base rounded-xl uppercase transition shadow-lg flex items-center justify-center gap-2"
            >
              📝 ENVIAR COMANDA (COCINA / BARRA)
            </button>

            {/* BOTÓN 2: COBRAR E IMPRIMIR */}
            <button
              onClick={cobrarEImprimir}
              disabled={ticketActual.length === 0}
              className="col-span-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black text-base rounded-xl uppercase transition shadow-lg flex items-center justify-center gap-2"
            >
              💳 COBRAR E IMPRIMIR ({calcularTotal().toFixed(2)}€)
            </button>
          </div>
        </div>

        {/* PANEL DERECHO: FAMILIAS Y PRODUCTOS TÁCTILES */}
        <div className="w-full lg:w-7/12 p-3 flex flex-col justify-between bg-slate-950">
          
          {/* Botones de Familias */}
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

          {/* Cuadrícula de Productos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 overflow-y-auto max-h-[78vh] pr-1 flex-1">
            {productosFiltrados.map((p) => (
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
            ))}
          </div>

        </div>
      </div>

      {/* Ticket para impresión */}
      <div id="ticket-print">
        <h2 style={{ textAlign: 'center', margin: '0 0 5px 0' }}>JORCO FUSIÓN</h2>
        <h3 style={{ textAlign: 'center', margin: '0 0 10px 0' }}>TICKET DE COMPRA</h3>
        <p>
          <strong>Zona:</strong> {zonaActiva} | <strong>Mesa:</strong> {mesaNum}
        </p>
        <hr />
        {ticketActual.map((item) => (
          <div
            key={item.id}
            style={{ display: 'flex', justifyCont: 'space-between', margin: '4px 0' }}
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
