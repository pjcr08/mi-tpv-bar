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

  const obtenerNombreMesa = (num, zona = zonaActiva) => {
    const clave = `${zona}-${num}`
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

  // Carga las comandas activas sincronizadas desde la BD / PDA
  const cargarComandasServidor = async () => {
    try {
      const { data: pedidosBD } = await supabase
        .from('pedidos')
        .select(`
          id,
          nota,
          mesa_id,
          mesas ( zona, numero ),
          lineas_pedido ( id, producto_nombre, precio, cantidad, destino, estado )
        `)
        .eq('estado', 'abierto')

      if (!pedidosBD) return

      const nuevosTickets = {}
      const nuevasNotas = {}

      pedidosBD.forEach((ped) => {
        if (ped.mesas) {
          const clave = `${ped.mesas.zona}-${ped.mesas.numero}`
          nuevasNotas[clave] = ped.nota || ''

          // Carga únicamente las líneas que no estén canceladas o ya cobradas
          const lineasValidas = (ped.lineas_pedido || []).filter(
            (l) => l.estado !== 'cancelado' && l.estado !== 'cobrado'
          )

          nuevosTickets[clave] = lineasValidas.map((l) => ({
            id: l.id,
            nombre: l.producto_nombre,
            precio: Number(l.precio),
            cantidad: l.cantidad,
            destino: l.destino,
            estado: l.estado,
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
      
      // Consultar si la mesa ya tiene un pedido en estado 'abierto'
      const { data: pedidoExistente } = await supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('estado', 'abierto')
        .maybeSingle()

      let pId = pedidoExistente?.id

      if (!pId) {
        const { data: nuevoPedido } = await supabase
          .from('pedidos')
          .insert([{ mesa_id: mesaId, estado: 'abierto', nota: notaActual }])
          .select()
          .single()
        if (nuevoPedido) pId = nuevoPedido.id
      } else {
        await supabase.from('pedidos').update({ nota: notaActual }).eq('id', pId)
      }

      if (pId) {
        // Eliminar líneas anteriores de este pedido para reescribir con las nuevas
        await supabase.from('lineas_pedido').delete().eq('pedido_id', pId)

        const lineas = ticketActual.map((item) => ({
          pedido_id: pId,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'pendiente',
        }))

        await supabase.from('lineas_pedido').insert(lineas)
      }

      setMultiplicador(1)
      alert(`🚀 Comanda enviada: ${zonaActiva} - ${nombreMesaActual}`)
      cargarComandasServidor()
    } catch (err) {
      alert(`❌ Error al enviar comanda: ${err.message || 'Error de conexión'}`)
    }
  }

  const cobrarEImprimir = async () => {
    if (ticketActual.length === 0) return

    try {
      window.print()
      const mesaId = await obtenerOCrearMesa()

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
      cargarComandasServidor()
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
      cargarComandasServidor()
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

      <div className="h-screen bg-slate-950 text-slate-100 flex flex-col no-imprimir select-none font-sans overflow-hidden">
        
        {/* ENCABEZADO TPV */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍹</span>
              <h1 className="font-black text-lg tracking-wider text-amber-500 uppercase">JORCO FUSIÓN</h1>
            </div>

            {/* SELECCIÓN DE ZONA */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZonaActiva(z)
                    setMesaNum(1)
                  }}
                  className={`px-3 py-1.5 font-extrabold text-xs rounded-lg uppercase transition-all ${
                    zonaActiva === z
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* SELECCIÓN DE MESA Y CLIENTE */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 pl-2 uppercase">Mesa:</span>
              <select
                value={mesaNum}
                onChange={(e) => setMesaNum(Number(e.target.value))}
                className="bg-slate-900 text-amber-400 font-black px-3 py-1 rounded-lg text-sm border border-slate-800 focus:outline-none"
              >
                {opcionesMesas.map((n) => {
                  const clave = `${zonaActiva}-${n}`
                  const tieneItems = ticketsPorMesa[clave] && ticketsPorMesa[clave].length > 0
                  const nombreVisual = obtenerNombreMesa(n)
                  return (
                    <option key={n} value={n}>
                      {nombreVisual} {tieneItems ? '🔴' : ''}
                    </option>
                  )
                })}
              </select>

              <button
                onClick={renombrarMesa}
                title="Cambiar nombre a esta mesa"
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold p-1.5 rounded-lg border border-slate-700 text-xs transition active:scale-95"
              >
                ✏️
              </button>
            </div>

            <input
              type="text"
              placeholder="👤 Nota o Alias Cliente"
              value={notaActual}
              onChange={(e) => handleNotaChange(e.target.value)}
              className="bg-slate-950 text-slate-100 font-bold px-3 py-1.5 rounded-xl border border-slate-800 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-52"
            />
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden p-3 gap-3">
          
          {/* PANEL IZQUIERDO: TICKET Y TECLADO */}
          <div className="w-4/12 flex flex-col gap-2 bg-slate-900 p-3 rounded-2xl border border-slate-800/80 shadow-xl">
            
            {/* TICKET ACTUAL */}
            <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded-xl p-3 overflow-y-auto flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <span>Cant / Producto</span>
                  <span>Importe</span>
                </div>

                {ticketActual.length === 0 ? (
                  <div className="text-center text-slate-600 text-xs mt-16 font-medium">
                    <span className="block text-2xl mb-1">🛒</span>
                    Mesa vacía
                  </div>
                ) : (
                  <div className="space-y-1.5 mt-2">
                    <div className="bg-slate-900 border border-slate-800/80 text-amber-400 text-xs font-black px-2.5 py-1.5 rounded-lg flex justify-between items-center">
                      <span>📍 {zonaActiva} - {nombreMesaActual}</span>
                      {notaActual && <span className="text-slate-300 font-bold truncate max-w-[120px]">👤 {notaActual}</span>}
                    </div>

                    {ticketActual.map((item) => (
                      <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-slate-900 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-md border border-slate-800">
                            <button
                              onClick={() => cambiarCantidadItem(item.id, -1)}
                              className="w-5 h-5 bg-rose-500/20 text-rose-400 font-black rounded hover:bg-rose-500 hover:text-white transition flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <span className="font-extrabold text-slate-200 px-1">{item.cantidad}</span>
                            <button
                              onClick={() => cambiarCantidadItem(item.id, 1)}
                              className="w-5 h-5 bg-emerald-500/20 text-emerald-400 font-black rounded hover:bg-emerald-500 hover:text-white transition flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-bold text-slate-200 line-clamp-1">{item.nombre}</span>
                        </div>
                        <span className="font-black text-amber-400 pl-2">
                          {(Number(item.precio) * item.cantidad).toFixed(2)}€
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TOTAL MESA */}
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center mt-3">
                <span className="text-xs font-black text-slate-400 uppercase">Total a pagar</span>
                <span className="font-black text-2xl text-amber-400">{calcularTotal().toFixed(2)}€</span>
              </div>
            </div>

            {/* TECLADO MULTIPLICADOR */}
            <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
              {[1, 2, 3, 'C', 4, 5, 6, 0, 7, 8, 9].map((val) => (
                <button
                  key={val}
                  onClick={() => presionarTeclado(val)}
                  className={`py-2 font-black text-sm rounded-lg border transition active:scale-95 ${
                    val === 'C'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500 hover:text-white'
                      : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {val}
                </button>
              ))}
              <div className="bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center font-black text-amber-400 rounded-lg">
                <span className="text-[9px] uppercase text-amber-500/80">Unid.</span>
                <span className="text-sm">{multiplicador}x</span>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: FAMILIAS, PRODUCTOS Y ACCIONES */}
          <div className="w-8/12 flex flex-col gap-3">
            
            {/* BARRA DE FAMILIAS */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {familias.map((f) => (
                <button
                  key={f}
                  onClick={() => setFamiliaActiva(f)}
                  className={`px-4 py-2.5 font-black text-xs uppercase rounded-xl border whitespace-nowrap transition-all shadow-sm ${
                    familiaActiva === f
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/10 scale-[1.02]'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* GRID DE PRODUCTOS */}
            <div className="flex-1 grid grid-cols-4 gap-2.5 bg-slate-900 p-3 rounded-2xl border border-slate-800/80 overflow-y-auto">
              {productosFiltrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => agregarAlTicket(p)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3 flex flex-col justify-between h-28 shadow-sm active:scale-95 transition text-left group"
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-extrabold text-xs text-slate-200 uppercase leading-snug line-clamp-2">
                      {p.nombre}
                    </span>
                    <span className="text-xl group-hover:scale-110 transition">{p.img || '🍽️'}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-900 pt-1.5 w-full">
                    <span className="text-[9px] text-slate-500 font-black uppercase">{p.destino}</span>
                    <span className="text-sm font-black text-amber-400">{Number(p.precio).toFixed(2)}€</span>
                  </div>
                </button>
              ))}
            </div>

            {/* BOTONERA PRINCIPAL ACCIONES */}
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={enviarComanda}
                disabled={ticketActual.length === 0}
                className="py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-blue-600/10 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <span>🚀</span>
                <span>Enviar Comanda</span>
              </button>

              <button
                onClick={cobrarEImprimir}
                disabled={ticketActual.length === 0}
                className="py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-emerald-600/10 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <span>💳</span>
                <span>Cobrar Ticket</span>
              </button>

              <button
                onClick={() => window.print()}
                disabled={ticketActual.length === 0}
                className="py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg shadow-amber-500/10 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span>
                <span>Proforma</span>
              </button>

              <button
                onClick={borrarTicketMesa}
                disabled={ticketActual.length === 0}
                className="py-3.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 disabled:opacity-30 font-black text-xs uppercase rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <span>🗑️</span>
                <span>Anular Mesa</span>
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
