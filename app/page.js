'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])

  // ZONA Y MESAS
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // NOMBRES PERSONALIZADOS PARA MESAS
  const [nombresMesas, setNombresMesas] = useState({})

  // ESTADO DE TICKETS Y NOTAS PERSISTENTES POR MESA
  const [ticketsPorMesa, setTicketsPorMesa] = useState({})
  const [notasPorMesa, setNotasPorMesa] = useState({})

  // Multiplicador / Unidades
  const [multiplicador, setMultiplicador] = useState(1)

  const claveMesaActual = `${zonaActiva}-${mesaNum}`
  const ticketActual = ticketsPorMesa[claveMesaActual] || []
  const notaActual = notasPorMesa[claveMesaActual] || ''

  const obtenerNombreMesa = (num) => {
    const clave = `${zonaActiva}-${num}`
    return nombresMesas[clave] || `Mesa ${num}`
  }

  const nombreMesaActual = obtenerNombreMesa(mesaNum)

  useEffect(() => {
    cargarProductos()
    cargarNombresMesas()
    cargarComandasServidor()

    // ESCUCHA EN TIEMPO REAL (REALTIME DE SUPABASE)
    const channel = supabase
      .channel('tpv-realtime-home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarComandasServidor()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarComandasServidor()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        cargarNombresMesas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [zonaActiva, mesaNum])

  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (error || !data) return
      setProductos(data)
      const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)
      if (fams.length > 0) {
        setFamilias(fams)
        setFamiliaActiva(fams[0])
      }
    } catch (err) {
      console.error('Error al cargar productos:', err)
    }
  }

  const cargarNombresMesas = async () => {
    try {
      const { data } = await supabase.from('mesas').select('zona, numero, nombre_custom')
      if (data) {
        const mapa = {}
        data.forEach((m) => {
          if (m.nombre_custom) mapa[`${m.zona}-${m.numero}`] = m.nombre_custom
        })
        setNombresMesas(mapa)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Carga todas las comandas en estado "abierto" de la BD
  const cargarComandasServidor = async () => {
    try {
      const { data: pedidosBD } = await supabase
        .from('pedidos')
        .select(`
          id,
          nota,
          mesa_id,
          mesas ( zona, numero ),
          lineas_pedido ( id, producto_nombre, precio, cantidad, destino )
        `)
        .eq('estado', 'abierto')

      if (!pedidosBD) return

      const nuevosTickets = {}
      const nuevasNotas = {}

      pedidosBD.forEach((ped) => {
        if (ped.mesas) {
          const clave = `${ped.mesas.zona}-${ped.mesas.numero}`
          nuevasNotas[clave] = ped.nota || ''
          nuevosTickets[clave] = (ped.lineas_pedido || []).map((l) => ({
            id: l.id,
            nombre: l.producto_nombre,
            precio: Number(l.precio),
            cantidad: l.cantidad,
            destino: l.destino,
          }))
        }
      })

      setTicketsPorMesa(nuevosTickets)
      setNotasPorMesa(nuevasNotas)
    } catch (err) {
      console.error('Error cargando comandas activas:', err)
    }
  }

  const handleNotaChange = (nuevaNota) => {
    setNotasPorMesa({ ...notasPorMesa, [claveMesaActual]: nuevaNota })
  }

  const renombrarMesa = async () => {
    const nombreActual = obtenerNombreMesa(mesaNum)
    const nuevoNombre = prompt(`Introduce un nuevo nombre para ${zonaActiva} - ${nombreActual}:`, nombreActual)

    if (nuevoNombre !== null && nuevoNombre.trim() !== '') {
      const nombreLimpio = nuevoNombre.trim()
      setNombresMesas({
        ...nombresMesas,
        [claveMesaActual]: nombreLimpio,
      })

      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('zona', zonaActiva)
        .eq('numero', mesaNum)
        .maybeSingle()

      if (mesaBD) {
        await supabase.from('mesas').update({ nombre_custom: nombreLimpio }).eq('id', mesaBD.id)
      } else {
        await supabase.from('mesas').insert([{ zona: zonaActiva, numero: mesaNum, nombre_custom: nombreLimpio }])
      }
    }
  }

  const agregarAlTicket = (prod) => {
    const cantAgregar = multiplicador > 0 ? multiplicador : 1
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []
    const existe = ticketExistente.find((item) => item.nombre === prod.nombre)

    let nuevoTicket = []
    if (existe) {
      nuevoTicket = ticketExistente.map((item) =>
        item.nombre === prod.nombre ? { ...item, cantidad: item.cantidad + cantAgregar } : item
      )
    } else {
      nuevoTicket = [...ticketExistente, { ...prod, id: Date.now(), cantidad: cantAgregar }]
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
      alert(`📝 Comanda enviada: ${zonaActiva} - ${nombreMesaActual}`)
    } catch (err) {
      alert(`❌ Error al enviar comanda: ${err.message || 'Error de conexión'}`)
    }
  }

  const cobrarEImprimir = async () => {
    if (ticketActual.length === 0) return

    try {
      window.print()
      const mesaId = await obtenerOCrearMesa()

      // Guardar cobrado en BD
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

      // Marcar comandas abiertas como cobradas
      await supabase.from('pedidos').update({ estado: 'cobrado' }).eq('mesa_id', mesaId).eq('estado', 'abierto')

      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)

      const copiaNotas = { ...notasPorMesa }
      delete copiaNotas[claveMesaActual]
      setNotasPorMesa(copiaNotas)

      setMultiplicador(1)
      alert('💳 Cobro registrado')
    } catch (e) {
      console.error(e)
    }
  }

  const borrarTicketMesa = async () => {
    if (confirm(`¿Limpiar ticket de ${zonaActiva} - ${nombreMesaActual}?`)) {
      const copiaTickets = { ...ticketsPorMesa }
      delete copiaTickets[claveMesaActual]
      setTicketsPorMesa(copiaTickets)

      const copiaNotas = { ...notasPorMesa }
      delete copiaNotas[claveMesaActual]
      setNotasPorMesa(copiaNotas)

      const mesaId = await obtenerOCrearMesa()
      if (mesaId) {
        await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('mesa_id', mesaId).eq('estado', 'abierto')
      }
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
        
        {/* ENCABEZADO */}
        <header className="bg-amber-500 border-b border-amber-600 px-3 py-1.5 flex justify-between items-center text-slate-900 shadow">
          <div className="flex items-center gap-3">
            <h1 className="font-black text-xl tracking-wide uppercase">JORCO FUSIÓN TPV</h1>
            
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

              <button
                onClick={renombrarMesa}
                title="Cambiar nombre a esta mesa"
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold p-1.5 rounded border-2 border-slate-900 text-sm shadow active:scale-95 transition"
              >
                ✏️
              </button>
            </div>

            <input
              type="text"
              placeholder="Ej: Camiseta blanca / Gorra"
              value={notaActual}
              onChange={(e) => handleNotaChange(e.target.value)}
              className="bg-white text-slate-900 font-bold px-3 py-1 rounded border-2 border-slate-900 text-sm shadow placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 w-56"
            />
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden p-2 gap-2">
          
          {/* TICKET Y TECLADO */}
          <div className="w-4/12 flex flex-col gap-2 bg-slate-200 p-2 rounded border border-slate-300">
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

              <div className="bg-sky-100 border border-sky-300 p-2 rounded text-right mt-2">
                <span className="text-xs font-bold text-sky-800 uppercase block">Total a pagar</span>
                <span className="font-black text-2xl text-sky-950">{calcularTotal().toFixed(2)}€</span>
              </div>
            </div>

            {/* TECLADO NUMÉRICO */}
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

          {/* FAMILIAS Y PRODUCTOS DE BASE DE DATOS */}
          <div className="w-8/12 flex flex-col gap-2">
            
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

            {/* BOTONERA ACCIONES */}
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

      {/* IMPRESIÓN */}
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
