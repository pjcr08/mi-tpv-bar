'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Productos de prueba con colores asignados al estilo TPV Clásico
const PRODUCTOS_EJEMPLO = [
  // CAFÉS
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra', color: 'bg-amber-700 text-white' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra', color: 'bg-amber-600 text-white' },
  { id: 103, nombre: 'Café Jorco Especial', precio: 2.20, familia: 'Cafés', destino: 'barra', color: 'bg-yellow-500 text-black' },
  { id: 104, nombre: 'Cortado', precio: 1.30, familia: 'Cafés', destino: 'barra', color: 'bg-amber-800 text-white' },
  { id: 105, nombre: 'Carajillo', precio: 2.00, familia: 'Cafés', destino: 'barra', color: 'bg-orange-700 text-white' },
  
  // BEBIDAS
  { id: 106, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra', color: 'bg-blue-600 text-white' },
  { id: 107, nombre: 'Refresco Cola', precio: 2.20, familia: 'Bebidas', destino: 'barra', color: 'bg-red-600 text-white' },
  { id: 108, nombre: 'Agua 50cl', precio: 1.50, familia: 'Bebidas', destino: 'barra', color: 'bg-cyan-500 text-black' },
  { id: 109, nombre: 'Cerveza 1/3 Tercio', precio: 2.80, familia: 'Bebidas', destino: 'barra', color: 'bg-blue-700 text-white' },
  { id: 110, nombre: 'Copa de Vino', precio: 3.00, familia: 'Bebidas', destino: 'barra', color: 'bg-purple-700 text-white' },

  // COMIDA
  { id: 111, nombre: 'Bocadillo Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina', color: 'bg-emerald-600 text-white' },
  { id: 112, nombre: 'Ración Bravas', precio: 6.00, familia: 'Comida', destino: 'cocina', color: 'bg-red-500 text-white' },
  { id: 113, nombre: 'Pincho Tortilla', precio: 3.50, familia: 'Comida', destino: 'cocina', color: 'bg-yellow-400 text-black' },
  { id: 114, nombre: 'Hamburguesa Jorco', precio: 8.50, familia: 'Comida', destino: 'cocina', color: 'bg-emerald-700 text-white' },

  // POSTRES
  { id: 115, nombre: 'Tarta Queso', precio: 4.00, familia: 'Postres', destino: 'cocina', color: 'bg-pink-500 text-white' },
  { id: 116, nombre: 'Flan Casero', precio: 3.50, familia: 'Postres', destino: 'cocina', color: 'bg-fuchsia-600 text-white' },
  { id: 117, nombre: 'Helado 2 Bolas', precio: 3.00, familia: 'Postres', destino: 'cocina', color: 'bg-pink-400 text-black' },
]

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])

  // Selección de Mesa
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // ESTADO DE TICKETS POR MESA
  const [ticketsPorMesa, setTicketsPorMesa] = useState({})

  // Teclado numérico / Unidades
  const [multiplicador, setMultiplicador] = useState(1)

  const claveMesaActual = `${zonaActiva}-${mesaNum}`
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

  const agregarAlTicket = (prod) => {
    const cantAgregar = multiplicador > 0 ? multiplicador : 1
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []
    const existe = ticketExistente.find((item) => item.id === prod.id)

    let nuevoTicket = []
    if (existe) {
      nuevoTicket = ticketExistente.map((item) =>
        item.id === prod.id ? { ...item, cantidad: item.cantidad + cantAgregar } : item
      )
    } else {
      nuevoTicket = [...ticketExistente, { ...prod, cantidad: cantAgregar }]
    }

    setTicketsPorMesa({ ...ticketsPorMesa, [claveMesaActual]: nuevoTicket })
    setMultiplicador(1)
  }

  const cambiarCantidadItem = (id, delta) => {
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []
    const nuevoTicket = ticketExistente
      .map((item) => (item.id === id ? { ...item, cantidad: item.cantidad + delta } : item))
      .filter((item) => item.cantidad > 0)

    setTicketsPorMesa({ ...ticketsPorMesa, [claveMesaActual]: nuevoTicket })
  }

  const calcularTotal = () => {
    return ticketActual.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)
  }

  const presionarTeclado = (num) => {
    if (num === 'C') {
      setMultiplicador(1)
    } else {
      const nuevoVal = multiplicador === 1 ? String(num) : String(multiplicador) + String(num)
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

      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'abierto' }])
        .select()
        .single()

      if (errPedido) {
        alert(`❌ Error en Pedidos: ${errPedido.message}`)
        return
      }

      if (pedido) {
        const lineas = ticketActual.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'pendiente',
        }))

        await supabase.from('lineas_pedido').insert(lineas)
      }

      setMultiplicador(1)
      alert(`📝 Comanda enviada: ${zonaActiva} - Mesa ${mesaNum}`)
    } catch (err) {
      alert(`❌ Error inesperado: ${err.message || 'Error de red'}`)
    }
  }

  const cobrarEImprimir = async () => {
    if (ticketActual.length === 0) return

    try {
      window.print()

      const mesaId = await obtenerOCrearMesa()
      const { data: pedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'cobrado' }])
        .select()
        .single()

      if (pedido) {
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

      const copia = { ...ticketsPorMesa }
      delete copia[claveMesaActual]
      setTicketsPorMesa(copia)
      setMultiplicador(1)
      alert('💳 Cobro realizado con éxito')
    } catch {
      const copia = { ...ticketsPorMesa }
      delete copia[claveMesaActual]
      setTicketsPorMesa(copia)
      setMultiplicador(1)
    }
  }

  const borrarTicketMesa = () => {
    if (confirm(`¿Borrar productos de ${zonaActiva} - Mesa ${mesaNum}?`)) {
      const copia = { ...ticketsPorMesa }
      delete copia[claveMesaActual]
      setTicketsPorMesa(copia)
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

      <div className="h-screen bg-slate-200 text-slate-900 flex flex-col no-imprimir select-none font-sans overflow-hidden">
        
        {/* BARRA SUPERIOR DE ZONAS Y MESA */}
        <header className="bg-slate-300 border-b border-slate-400 p-2 flex justify-between items-center shadow-sm">
          <div className="flex gap-2 items-center">
            <span className="font-black text-slate-800 text-lg mr-2">JORCO FUSIÓN TPV</span>
            {['Terraza', 'Salón', 'Barra'].map((z) => (
              <button
                key={z}
                onClick={() => {
                  setZonaActiva(z)
                  setMesaNum(rangosZona[z].min)
                }}
                className={`px-4 py-2 font-black rounded text-sm uppercase transition shadow ${
                  zonaActiva === z
                    ? 'bg-blue-600 text-white border-2 border-blue-800'
                    : 'bg-white text-slate-800 border border-slate-400 hover:bg-slate-100'
                }`}
              >
                {z}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 text-sm">SELECCIÓN MESA:</span>
            <select
              value={mesaNum}
              onChange={(e) => setMesaNum(Number(e.target.value))}
              className="bg-white text-blue-900 font-black px-4 py-2 rounded border-2 border-blue-600 text-lg shadow-sm"
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
        </header>

        {/* ESTRUCTURA DE 3 COLUMNAS TPV CLÁSICO */}
        <div className="flex-1 flex overflow-hidden p-2 gap-2">
          
          {/* 1. COLUMNA IZQUIERDA: NUMÉRICO + TICKET */}
          <div className="w-3/12 flex flex-col gap-2 bg-slate-300 p-2 rounded border border-slate-400">
            {/* Teclado Numérico arriba */}
            <div className="grid grid-cols-4 gap-1 bg-slate-400 p-1 rounded border border-slate-500">
              {[1, 2, 3, 'C', 4, 5, 6, 0, 7, 8, 9].map((val) => (
                <button
                  key={val}
                  onClick={() => presionarTeclado(val)}
                  className={`p-2 font-black text-base rounded shadow border border-slate-400 active:scale-95 ${
                    val === 'C' ? 'bg-red-600 text-white' : 'bg-white text-slate-900'
                  }`}
                >
                  {val}
                </button>
              ))}
              <div className="bg-amber-300 border border-amber-500 flex items-center justify-center font-black text-slate-900 rounded">
                {multiplicador}x
              </div>
            </div>

            {/* Visor de Ticket */}
            <div className="flex-1 bg-white border border-slate-400 rounded p-2 overflow-y-auto flex flex-col justify-between">
              <div>
                <div className="flex justify-between font-black text-xs border-b border-slate-300 pb-1 mb-2 text-slate-600 uppercase">
                  <span>Cant/Prod</span>
                  <span>Total</span>
                </div>
                {ticketActual.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-100 py-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => cambiarCantidadItem(item.id, -1)} className="w-5 h-5 bg-red-500 text-white font-bold rounded">
                        -
                      </button>
                      <button onClick={() => cambiarCantidadItem(item.id, 1)} className="w-5 h-5 bg-green-600 text-white font-bold rounded">
                        +
                      </button>
                      <span className="font-semibold">{item.cantidad}x {item.nombre}</span>
                    </div>
                    <span className="font-black">{(Number(item.precio) * item.cantidad).toFixed(2)}€</span>
                  </div>
                ))}
              </div>

              {/* Total acumulado */}
              <div className="bg-teal-700 text-white p-3 rounded text-right font-black text-xl border-t-2 border-teal-900 mt-2">
                TOTAL: {calcularTotal().toFixed(2)}€
              </div>
            </div>
          </div>

          {/* 2. COLUMNA CENTRO: FAMILIAS + PRODUCTOS TÁCTILES */}
          <div className="w-7/12 flex flex-col gap-2">
            {/* Familias de Productos (Pestañas horizontales) */}
            <div className="grid grid-cols-4 gap-1">
              {familias.map((f) => (
                <button
                  key={f}
                  onClick={() => setFamiliaActiva(f)}
                  className={`py-3 font-black text-sm uppercase rounded shadow border-2 transition ${
                    familiaActiva === f
                      ? 'bg-blue-600 text-white border-blue-900 scale-[1.01]'
                      : 'bg-slate-300 text-slate-800 border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Cuadrícula de Productos */}
            <div className="flex-1 grid grid-cols-4 gap-2 bg-slate-300 p-2 rounded border border-slate-400 overflow-y-auto">
              {productosFiltrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregarAlTicket(p)}
                  className={`p-3 rounded-lg border-2 border-slate-500 shadow-md font-bold flex flex-col justify-between h-24 text-left active:scale-95 transition ${
                    p.color || 'bg-white text-slate-900'
                  }`}
                >
                  <span className="text-sm leading-tight uppercase font-extrabold">{p.nombre}</span>
                  <div className="flex justify-between items-end border-t border-black/20 pt-1 w-full">
                    <span className="text-[10px] uppercase opacity-80">{p.destino}</span>
                    <span className="text-lg font-black">{Number(p.precio).toFixed(2)}€</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. COLUMNA DERECHA: BOTONERA DE ACCIONES RÁPIDAS TPV */}
          <div className="w-2/12 bg-slate-300 p-2 rounded border border-slate-400 flex flex-col gap-2">
            <button
              onClick={enviarComanda}
              disabled={ticketActual.length === 0}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-sm rounded border-2 border-red-800 shadow uppercase flex flex-col items-center justify-center p-2 text-center"
            >
              <span>📝 ENVIAR</span>
              <span>COMANDA</span>
            </button>

            <button
              onClick={cobrarEImprimir}
              disabled={ticketActual.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-sm rounded border-2 border-blue-800 shadow uppercase flex flex-col items-center justify-center p-2 text-center"
            >
              <span>💳 COBRAR E</span>
              <span>IMPRIMIR</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={ticketActual.length === 0}
              className="h-14 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-black text-xs rounded border-2 border-amber-700 shadow uppercase"
            >
              🖨️ PROFORMA
            </button>

            <button
              onClick={borrarTicketMesa}
              disabled={ticketActual.length === 0}
              className="h-14 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-black text-xs rounded border-2 border-gray-900 shadow uppercase"
            >
              🗑️ ANULAR MESA
            </button>

            <button
              onClick={() => setMultiplicador(1)}
              className="h-14 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs rounded border-2 border-pink-800 shadow uppercase"
            >
              🔄 RESET UNIDADES
            </button>
          </div>

        </div>
      </div>

      {/* Ticket Térmico de Impresión */}
      <div id="ticket-print">
        <h2 style={{ textAlign: 'center', margin: '0 0 5px 0' }}>JORCO FUSIÓN</h2>
        <h3 style={{ textAlign: 'center', margin: '0 0 10px 0' }}>TICKET DE COMPRA</h3>
        <p><strong>Zona:</strong> {zonaActiva} | <strong>Mesa:</strong> {mesaNum}</p>
        <hr />
        {ticketActual.map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
            <span>{item.cantidad}x {item.nombre}</span>
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
