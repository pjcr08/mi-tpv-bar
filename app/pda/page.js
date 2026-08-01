'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Productos de prueba con imágenes e iconos táctiles al estilo del nuevo TPV
const PRODUCTOS_EJEMPLO = [
  // CAFÉS
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra', img: '☕' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra', img: '🥛' },
  { id: 103, nombre: 'Jorco Especial', precio: 2.20, familia: 'Cafés', destino: 'barra', img: '⭐' },
  { id: 104, nombre: 'Cortado', precio: 1.30, familia: 'Cafés', destino: 'barra', img: '☕' },
  { id: 105, nombre: 'Carajillo', precio: 2.00, familia: 'Cafés', destino: 'barra', img: '🥃' },

  // BEBIDAS
  { id: 106, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra', img: '🍺' },
  { id: 107, nombre: 'Refresco Cola', precio: 2.20, familia: 'Bebidas', destino: 'barra', img: '🥤' },
  { id: 108, nombre: 'Agua 50cl', precio: 1.50, familia: 'Bebidas', destino: 'barra', img: '💧' },
  { id: 109, nombre: 'Tercio 1/3', precio: 2.80, familia: 'Bebidas', destino: 'barra', img: '🍾' },
  { id: 110, nombre: 'Copa Vino', precio: 3.00, familia: 'Bebidas', destino: 'barra', img: '🍷' },

  // COMIDA
  { id: 111, nombre: 'Bocad. Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina', img: '🥖' },
  { id: 112, nombre: 'Ración Bravas', precio: 6.00, familia: 'Comida', destino: 'cocina', img: '🍟' },
  { id: 113, nombre: 'Pincho Tortilla', precio: 3.50, familia: 'Comida', destino: 'cocina', img: '🍳' },
  { id: 114, nombre: 'Burger Jorco', precio: 8.50, familia: 'Comida', destino: 'cocina', img: '🍔' },
  { id: 115, nombre: 'Pizza Jamón', precio: 9.00, familia: 'Comida', destino: 'cocina', img: '🍕' },
  { id: 116, nombre: 'Ensalada', precio: 5.50, familia: 'Comida', destino: 'cocina', img: '🥗' },

  // POSTRES
  { id: 117, nombre: 'Tarta Queso', precio: 4.00, familia: 'Postres', destino: 'cocina', img: '🍰' },
  { id: 118, nombre: 'Flan Casero', precio: 3.50, familia: 'Postres', destino: 'cocina', img: '🍮' },
  { id: 119, nombre: 'Helado 2 Bolas', precio: 3.00, familia: 'Postres', destino: 'cocina', img: '🍨' },
]

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])

  // ZONA Y MESAS (Ahora 1 a 20 para todas las zonas)
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // NOMBRES PERSONALIZADOS PARA MESAS (ej: 'Terraza-1': 'Mesa VIP')
  const [nombresMesas, setNombresMesas] = useState({})

  // ESTADO DE TICKETS Y NOTAS PERSISTENTES POR MESA
  const [ticketsPorMesa, setTicketsPorMesa] = useState({})
  const [notasPorMesa, setNotasPorMesa] = useState({})

  // Multiplicador / Unidades
  const [multiplicador, setMultiplicador] = useState(1)

  const claveMesaActual = `${zonaActiva}-${mesaNum}`
  const ticketActual = ticketsPorMesa[claveMesaActual] || []
  const notaActual = notasPorMesa[claveMesaActual] || ''

  // Obtener el nombre visual de la mesa (personalizado o predeterminado)
  const obtenerNombreMesa = (num) => {
    const clave = `${zonaActiva}-${num}`
    return nombresMesas[clave] || `Mesa ${num}`
  }

  const nombreMesaActual = obtenerNombreMesa(mesaNum)

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

  // Cambiar la nota/alias de la mesa actual
  const handleNotaChange = (nuevaNota) => {
    setNotasPorMesa({ ...notasPorMesa, [claveMesaActual]: nuevaNota })
  }

  // Renombrar la mesa actual
  const renombrarMesa = () => {
    const nombreActual = obtenerNombreMesa(mesaNum)
    const nuevoNombre = prompt(`Introduce un nuevo nombre para ${zonaActiva} - ${nombreActual}:`, nombreActual)

    if (nuevoNombre !== null && nuevoNombre.trim() !== '') {
      setNombresMesas({
        ...nombresMesas,
        [claveMesaActual]: nuevoNombre.trim(),
      })
    }
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
      const { data: pedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'abierto', nota: notaActual }])
        .select()
        .single()

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
      alert(`📝 Comanda enviada: ${zonaActiva} - ${nombreMesaActual} ${notaActual ? `(${notaActual})` : ''}`)
    } catch (err) {
      alert(`❌ Error al enviar comanda: ${err.message || 'Error de conexión'}`)
    }
  }

  const cobrarEImprimir = async () => {
    if (ticketActual.length === 0) return

    try {
      window.print()
      const mesaId = await obtenerOCrearMesa()
      const { data: pedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'cobrado', nota: notaActual }])
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

      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)

      const copiaNotas = { ...notasPorMesa }
      delete copiaNotas[claveMesaActual]
      setNotasPorMesa(copiaNotas)

      setMultiplicador(1)
      alert('💳 Cobro registrado y ticket emitido')
    } catch {
      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)

      const copiaNotas = { ...notasPorMesa }
      delete copiaNotas[claveMesaActual]
      setNotasPorMesa(copiaNotas)

      setMultiplicador(1)
    }
  }

  const borrarTicketMesa = () => {
    if (confirm(`¿Limpiar ticket y descripción de ${zonaActiva} - ${nombreMesaActual}?`)) {
      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)

      const copiaNotas = { ...notasPorMesa }
      delete copiaNotas[claveMesaActual]
      setNotasPorMesa(copiaNotas)
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)
  const opcionesMesas = Array.from({ length: 20 }, (_, i) => i + 1)

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

      <div className="h-screen bg-slate-100 text-slate-800 flex flex-col no-imprimir select-none font-sans overflow-hidden">
        
        {/* ENCABEZADO DE CONFIGURACIÓN Y MESA */}
        <header className="bg-amber-500 border-b border-amber-600 px-3 py-1.5 flex justify-between items-center text-slate-900 shadow">
          <div className="flex items-center gap-3">
            <h1 className="font-black text-xl tracking-wide uppercase">JORCO FUSIÓN TPV</h1>
            
            {/* ZONAS */}
            <div className="flex bg-amber-600/40 p-1 rounded-lg gap-1 border border-amber-700/30">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZonaActiva(z)
                    setMesaNum(1)
                  }}
                  className={`px-3 py-1 font-black text-xs rounded uppercase transition ${
                    zonaActiva === z
                      ? 'bg-slate-900 text-amber-400 shadow'
                      : 'bg-amber-100/30 text-slate-900 hover:bg-amber-200'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* SELECTOR DE MESA + RENOMBRAR + ALIAS */}
          <div className="flex items-center gap-2">
            <span className="font-black text-xs uppercase">UBICACIÓN:</span>
            
            <div className="flex items-center gap-1">
              <select
                value={mesaNum}
                onChange={(e) => setMesaNum(Number(e.target.value))}
                className="bg-white text-slate-900 font-black px-3 py-1 rounded border-2 border-slate-900 text-base shadow"
              >
                {opcionesMesas.map((n) => {
                  const clave = `${zonaActiva}-${n}`
                  const tieneItems = ticketsPorMesa[clave] && ticketsPorMesa[clave].length > 0
                  const nombreVisual = obtenerNombreMesa(n)
                  return (
                    <option key={n} value={n}>
                      {nombreVisual} {tieneItems ? '🔴 (Abierta)' : ''}
                    </option>
                  )
                })}
              </select>

              {/* BOTÓN PARA CAMBIAR NOMBRE DE MESA */}
              <button
                onClick={renombrarMesa}
                title="Cambiar nombre a esta mesa"
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold p-1.5 rounded border-2 border-slate-900 text-sm shadow active:scale-95 transition"
              >
                ✏️
              </button>
            </div>

            {/* INPUT PARA ALIAS DEL CLIENTE */}
            <input
              type="text"
              placeholder="Ej: Camiseta blanca / Gorra"
              value={notaActual}
              onChange={(e) => handleNotaChange(e.target.value)}
              className="bg-white text-slate-900 font-bold px-3 py-1 rounded border-2 border-slate-900 text-sm shadow placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 w-56"
            />
          </div>
        </header>

        {/* ESTRUCTURA TPV INDUSTRIAL */}
        <div className="flex-1 flex overflow-hidden p-2 gap-2">
          
          {/* IZQUIERDA: TICKET + TECLADO */}
          <div className="w-4/12 flex flex-col gap-2 bg-slate-200 p-2 rounded border border-slate-300">
            {/* Visor de Ticket */}
            <div className="flex-1 bg-white border border-slate-300 rounded p-2 overflow-y-auto flex flex-col justify-between shadow-inner">
              <div>
                <div className="flex justify-between font-black text-xs border-b border-slate-300 pb-1 mb-2 text-slate-500 uppercase">
                  <span>Cant / Descripción</span>
                  <span>Total</span>
                </div>
                {ticketActual.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs mt-10 italic">
                    {zonaActiva} - {nombreMesaActual} {notaActual ? `("${notaActual}")` : ''} sin productos
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold px-2 py-1 rounded mb-2 flex justify-between">
                      <span>📍 {zonaActiva} - {nombreMesaActual}</span>
                      {notaActual && <span>👤 {notaActual}</span>}
                    </div>
                    {ticketActual.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-100 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => cambiarCantidadItem(item.id, -1)} className="w-5 h-5 bg-red-600 text-white font-black rounded text-xs">
                            -
                          </button>
                          <button onClick={() => cambiarCantidadItem(item.id, 1)} className="w-5 h-5 bg-emerald-600 text-white font-black rounded text-xs">
                            +
                          </button>
                          <span className="font-bold text-slate-800">{item.cantidad}x {item.nombre}</span>
                        </div>
                        <span className="font-black text-slate-900">{(Number(item.precio) * item.cantidad).toFixed(2)}€</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Total acumulado */}
              <div className="bg-sky-100 border border-sky-300 p-2 rounded text-right mt-2">
                <span className="text-xs font-bold text-sky-800 uppercase block">Total a pagar</span>
                <span className="font-black text-2xl text-sky-950">{calcularTotal().toFixed(2)}€</span>
              </div>
            </div>

            {/* Teclado Numérico */}
            <div className="grid grid-cols-4 gap-1 bg-slate-300 p-1.5 rounded border border-slate-400">
              {[1, 2, 3, 'C', 4, 5, 6, 0, 7, 8, 9].map((val) => (
                <button
                  key={val}
                  onClick={() => presionarTeclado(val)}
                  className={`p-2 font-black text-base rounded shadow border transition active:scale-95 ${
                    val === 'C' ? 'bg-red-500 text-white border-red-700' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {val}
                </button>
              ))}
              <div className="bg-amber-400 border border-amber-600 flex flex-col items-center justify-center font-black text-slate-900 rounded">
                <span className="text-[9px] uppercase">Unid.</span>
                <span className="text-base">{multiplicador}x</span>
              </div>
            </div>
          </div>

          {/* CENTRO: FAMILIAS + GRILLA CON ICONOS/IMÁGENES */}
          <div className="w-8/12 flex flex-col gap-2">
            
            {/* Pestañas de Familias */}
            <div className="grid grid-cols-4 gap-1.5">
              {familias.map((f) => (
                <button
                  key={f}
                  onClick={() => setFamiliaActiva(f)}
                  className={`py-2.5 font-black text-xs uppercase rounded border-2 transition shadow ${
                    familiaActiva === f
                      ? 'bg-slate-900 text-amber-400 border-slate-950 scale-[1.01]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Productos táctiles */}
            <div className="flex-1 grid grid-cols-4 gap-2 bg-slate-200 p-2 rounded border border-slate-300 overflow-y-auto">
              {productosFiltrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregarAlTicket(p)}
                  className="bg-white hover:bg-amber-50 border-2 border-slate-300 hover:border-amber-400 rounded-xl p-2 flex flex-col justify-between h-24 shadow-sm active:scale-95 transition text-left group"
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-extrabold text-xs text-slate-800 uppercase leading-snug line-clamp-2">
                      {p.nombre}
                    </span>
                    <span className="text-xl">{p.img || '🍽️'}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-100 pt-1 w-full">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{p.destino}</span>
                    <span className="text-base font-black text-amber-600">{Number(p.precio).toFixed(2)}€</span>
                  </div>
                </button>
              ))}
            </div>

            {/* BARRA INFERIOR DE ACCIONES RÁPIDAS */}
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={enviarComanda}
                disabled={ticketActual.length === 0}
                className="py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase rounded-lg border-b-4 border-blue-800 shadow"
              >
                📝 Enviar Comanda
              </button>

              <button
                onClick={cobrarEImprimir}
                disabled={ticketActual.length === 0}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase rounded-lg border-b-4 border-emerald-800 shadow"
              >
                💳 Cobrar e Imprimir
              </button>

              <button
                onClick={() => window.print()}
                disabled={ticketActual.length === 0}
                className="py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-black text-xs uppercase rounded-lg border-b-4 border-amber-700 shadow"
              >
                🖨️ Proforma
              </button>

              <button
                onClick={borrarTicketMesa}
                disabled={ticketActual.length === 0}
                className="py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs uppercase rounded-lg border-b-4 border-rose-800 shadow"
              >
                🗑️ Anular Mesa
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Ticket Térmico de Impresión */}
      <div id="ticket-print">
        <h2 style={{ textAlign: 'center', margin: '0 0 5px 0' }}>JORCO FUSIÓN</h2>
        <h3 style={{ textAlign: 'center', margin: '0 0 10px 0' }}>TICKET DE COMPRA</h3>
        <p><strong>Zona:</strong> {zonaActiva} | <strong>Mesa:</strong> {nombreMesaActual}</p>
        {notaActual && <p><strong>Cliente:</strong> {notaActual}</p>}
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
