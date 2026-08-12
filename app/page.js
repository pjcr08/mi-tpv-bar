'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function Page() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])

  // ZONA Y MESAS
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // ESTADO DE TICKETS Y NOTAS
  const [ticketsPorMesa, setTicketsPorMesa] = useState({})
  const [notasPorMesa, setNotasPorMesa] = useState({})

  // TECLADO Y MULTIPLICADOR
  const [multiplicador, setMultiplicador] = useState('1')

  const claveMesaActual = `${zonaActiva}-${mesaNum}`
  const ticketActual = ticketsPorMesa[claveMesaActual] || []
  const notaActual = notasPorMesa[claveMesaActual] || ''

  // CARGA DE PRODUCTOS
  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (error) {
        console.error('Error al cargar productos:', error)
        return
      }
      if (!data) return

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

  // CARGA DE COMANDAS ACTIVAS
  const cargarComandasServidor = async () => {
    try {
      const { data: pedidosBD, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          nota,
          mesa_id,
          mesas ( zona, numero ),
          lineas_pedido ( id, producto_nombre, precio, cantidad, destino, estado )
        `)
        .eq('estado', 'abierto')

      if (error) {
        console.error('Error al cargar comandas:', error)
        return
      }

      if (!pedidosBD) return

      const nuevosTickets = {}
      const nuevasNotas = {}

      pedidosBD.forEach((ped) => {
        if (ped.mesas) {
          const clave = `${ped.mesas.zona}-${ped.mesas.numero}`
          nuevasNotas[clave] = ped.nota || ''

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

      setTicketsPorMesa((prev) => ({ ...prev, ...nuevosTickets }))
      setNotasPorMesa((prev) => ({ ...prev, ...nuevasNotas }))
    } catch (err) {
      console.error('Error cargando comandas:', err)
    }
  }

  useEffect(() => {
    cargarProductos()
    cargarComandasServidor()

    const channel = supabase
      .channel('tpv-realtime-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarComandasServidor()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarComandasServidor()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleNotaChange = (nuevaNota) => {
    setNotasPorMesa((prev) => ({ ...prev, [claveMesaActual]: nuevaNota }))
  }

  const agregarAlTicket = (prod) => {
    const cantAgregar = Math.max(1, Number(multiplicador) || 1)
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []

    const existeIndice = ticketExistente.findIndex(
      (item) => item.nombre === prod.nombre && String(item.id).startsWith('temp-')
    )

    let nuevoTicket = [...ticketExistente]

    if (existeIndice !== -1) {
      nuevoTicket[existeIndice] = {
        ...nuevoTicket[existeIndice],
        cantidad: nuevoTicket[existeIndice].cantidad + cantAgregar,
      }
    } else {
      nuevoTicket.push({
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        nombre: prod.nombre,
        precio: Number(prod.precio),
        cantidad: cantAgregar,
        destino: prod.destino || 'barra',
        estado: 'borrador',
      })
    }

    setTicketsPorMesa((prev) => ({ ...prev, [claveMesaActual]: nuevoTicket }))
    setMultiplicador('1')
  }

  const cambiarCantidadItem = (id, delta) => {
    const ticketExistente = ticketsPorMesa[claveMesaActual] || []
    const nuevoTicket = ticketExistente
      .map((item) => {
        if (item.id === id) {
          const nuevaCant = item.cantidad + delta
          return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null
        }
        return item
      })
      .filter(Boolean)

    setTicketsPorMesa((prev) => ({ ...prev, [claveMesaActual]: nuevoTicket }))
  }

  const calcularTotal = () => {
    return ticketActual.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)
  }

  const presionarTeclado = (val) => {
    if (val === 'C') {
      setMultiplicador('1')
    } else {
      setMultiplicador((prev) => (prev === '1' ? String(val) : prev + String(val)))
    }
  }

  const obtenerOCrearMesa = async () => {
    try {
      const { data: mesaBD, error: errorBusqueda } = await supabase
        .from('mesas')
        .select('id')
        .eq('numero', mesaNum)
        .eq('zona', zonaActiva)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (errorBusqueda) return null
      if (mesaBD?.id) return mesaBD.id

      const { data: nuevaMesa, error: errorCreacion } = await supabase
        .from('mesas')
        .insert([{ numero: mesaNum, zona: zonaActiva }])
        .select('id')
        .single()

      if (errorCreacion) return null
      return nuevaMesa ? nuevaMesa.id : null
    } catch (err) {
      return null
    }
  }

  const enviarComanda = async () => {
    if (ticketActual.length === 0) return

    try {
      const mesaId = await obtenerOCrearMesa()
      if (!mesaId) return

      let pId = null
      const { data: pedidoExistente } = await supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('estado', 'abierto')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pedidoExistente?.id) {
        pId = pedidoExistente.id
        await supabase.from('pedidos').update({ nota: notaActual }).eq('id', pId)
      } else {
        const { data: nuevoPedido } = await supabase
          .from('pedidos')
          .insert([{ mesa_id: mesaId, estado: 'abierto', nota: notaActual }])
          .select('id')
          .single()
        pId = nuevoPedido?.id
      }

      if (!pId) return

      const lineasNuevas = ticketActual
        .filter((item) => String(item.id).startsWith('temp-') || item.estado === 'borrador')
        .map((item) => ({
          pedido_id: pId,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'pendiente',
        }))

      if (lineasNuevas.length > 0) {
        await supabase.from('lineas_pedido').insert(lineasNuevas)
      }

      setMultiplicador('1')
      alert('✨ Comanda enviada a cocina/barra')
      await cargarComandasServidor()
    } catch (err) {
      console.error(err)
    }
  }

  const cobrarEImprimir = async () => {
    if (ticketActual.length === 0) return

    try {
      window.print()
      const mesaId = await obtenerOCrearMesa()

      if (mesaId) {
        await supabase
          .from('pedidos')
          .update({ estado: 'cobrado' })
          .eq('mesa_id', mesaId)
          .eq('estado', 'abierto')
      }

      setTicketsPorMesa((prev) => {
        const copia = { ...prev }
        delete copia[claveMesaActual]
        return copia
      })

      setMultiplicador('1')
      alert('💳 Transacción completada')
      cargarComandasServidor()
    } catch (e) {
      console.error(e)
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-print, #ticket-print * { visibility: visible; }
          #ticket-print { position: absolute; left: 0; top: 0; width: 80mm; font-family: 'Courier New', monospace; font-size: 11px; }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      <div className="h-screen w-screen bg-[#0f1115] text-stone-200 flex flex-col font-sans select-none overflow-hidden no-imprimir antialiased">
        
        {/* BARRA SUPERIOR ELEGANTE */}
        <header className="h-14 bg-[#161920] border-b border-amber-500/20 px-6 flex justify-between items-center shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-serif font-bold text-lg">
              J
            </div>
            <div>
              <h1 className="font-serif tracking-widest text-sm font-semibold text-amber-200 uppercase">
                Jorco Fusión
              </h1>
              <p className="text-[10px] text-stone-400 tracking-wider uppercase">Gourmet & Cocktail Bar</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#0f1115] px-3 py-1.5 rounded-lg border border-stone-800">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Mesa Activa</span>
              <span className="text-xs font-semibold text-amber-400">{zonaActiva} — Mesa {mesaNum}</span>
            </div>
          </div>
        </header>

        {/* PANEL PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden p-3 gap-3">
          
          {/* COLUMNA IZQUIERDA: TICKET Y COBRO */}
          <div className="w-[38%] flex flex-col gap-3 bg-[#161920] p-3 rounded-xl border border-stone-800/80 shadow-2xl">
            
            {/* CABECERA TICKET Y CLIENTE */}
            <div className="flex items-center gap-2 bg-[#0f1115] p-2 rounded-lg border border-stone-800">
              <span className="text-amber-500/70 pl-1 text-sm">👤</span>
              <input
                type="text"
                placeholder="Nombre / Alias del cliente..."
                value={notaActual}
                onChange={(e) => handleNotaChange(e.target.value)}
                className="w-full bg-transparent text-xs text-stone-200 placeholder-stone-600 focus:outline-none font-medium"
              />
            </div>

            {/* LISTADO DE CONSUMICIONES */}
            <div className="flex-1 bg-[#0f1115] border border-stone-800/80 rounded-lg p-3 overflow-y-auto flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-12 pb-2 border-b border-stone-800 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  <span className="col-span-6">Artículo</span>
                  <span className="col-span-3 text-center">Cant.</span>
                  <span className="col-span-3 text-right">Importe</span>
                </div>

                {ticketActual.length === 0 ? (
                  <div className="text-center text-stone-600 my-20 font-serif italic text-xs">
                    Sin artículos seleccionados
                  </div>
                ) : (
                  <div className="divide-y divide-stone-900/60 mt-1">
                    {ticketActual.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 py-2.5 items-center text-xs">
                        <span className="col-span-6 font-medium text-stone-200 truncate pr-1">
                          {item.nombre}
                        </span>
                        
                        <div className="col-span-3 flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => cambiarCantidadItem(item.id, -1)}
                            className="w-5 h-5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs transition"
                          >
                            -
                          </button>
                          <span className="font-bold text-amber-400 text-xs w-4 text-center">
                            {item.cantidad}
                          </span>
                          <button
                            onClick={() => cambiarCantidadItem(item.id, 1)}
                            className="w-5 h-5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs transition"
                          >
                            +
                          </button>
                        </div>

                        <span className="col-span-3 text-right font-serif font-semibold text-stone-300">
                          {(item.precio * item.cantidad).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TOTAL MESA */}
              <div className="bg-[#161920] border border-stone-800 rounded-lg p-3 mt-2 flex justify-between items-center">
                <span className="text-xs uppercase font-semibold tracking-wider text-stone-400">Total</span>
                <span className="font-serif text-xl font-bold text-amber-400">
                  {calcularTotal().toFixed(2)} €
                </span>
              </div>
            </div>

            {/* TECLADO Y BOTONERA DE COMANDAS */}
            <div className="grid grid-cols-12 gap-2">
              {/* KEYPAD NUMÉRICO */}
              <div className="col-span-7 grid grid-cols-3 gap-1 bg-[#0f1115] p-1.5 rounded-lg border border-stone-800">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, `${multiplicador}x`].map((val, idx) => (
                  <button
                    key={idx}
                    onClick={() => typeof val === 'number' || val === 'C' ? presionarTeclado(val) : null}
                    className={`py-2 rounded text-xs font-semibold transition active:scale-95 ${
                      val === 'C'
                        ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                        : String(val).includes('x')
                        ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20'
                        : 'bg-[#161920] text-stone-300 hover:bg-stone-800 border border-stone-800/60'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              {/* ACCIONES RÁPIDAS */}
              <div className="col-span-5 flex flex-col gap-1.5">
                <button
                  onClick={enviarComanda}
                  disabled={ticketActual.length === 0}
                  className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-medium text-xs rounded-lg transition active:scale-95 disabled:opacity-30 flex items-center justify-center gap-1.5 uppercase tracking-wider"
                >
                  <span>📌</span> Enviar
                </button>
                <button
                  onClick={cobrarEImprimir}
                  disabled={ticketActual.length === 0}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg shadow-lg shadow-amber-500/10 transition active:scale-95 disabled:opacity-30 flex items-center justify-center gap-1.5 uppercase tracking-wider"
                >
                  <span>💳</span> Cobrar
                </button>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: SELECCIÓN DE PRODUCTOS Y MESA */}
          <div className="w-[62%] flex gap-3">
            
            {/* CATÁLOGO DE PRODUCTOS */}
            <div className="flex-1 flex flex-col gap-3">
              
              {/* CATEGORÍAS (FAMILIAS) */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {familias.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFamiliaActiva(f)}
                    className={`px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition whitespace-nowrap border ${
                      familiaActiva === f
                        ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-[#161920] text-stone-400 border-stone-800 hover:text-stone-200 hover:bg-stone-800/50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* GRID DE PRODUCTOS */}
              <div className="flex-1 grid grid-cols-3 gap-2.5 bg-[#161920] p-3 rounded-xl border border-stone-800/80 overflow-y-auto">
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarAlTicket(p)}
                    className="bg-[#0f1115] hover:bg-stone-900 border border-stone-800/80 hover:border-amber-500/40 rounded-xl p-3 flex flex-col justify-between h-24 transition active:scale-95 text-left group shadow-sm"
                  >
                    <span className="font-medium text-xs text-stone-200 line-clamp-2 leading-snug group-hover:text-amber-200 transition">
                      {p.nombre}
                    </span>
                    <div className="flex justify-between items-end border-t border-stone-900 pt-2 w-full">
                      <span className="text-[9px] uppercase tracking-wider text-stone-500 font-bold">
                        {p.destino || 'Barra'}
                      </span>
                      <span className="font-serif font-bold text-sm text-amber-400">
                        {Number(p.precio).toFixed(2)} €
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* BARRA DE ZONAS Y MESAS */}
            <div className="w-28 bg-[#161920] p-2 rounded-xl border border-stone-800/80 flex flex-col gap-2">
              <span className="text-[9px] uppercase font-bold text-stone-500 tracking-widest text-center">
                Zonas
              </span>
              <div className="flex flex-col gap-1">
                {['Terraza', 'Salón', 'Barra'].map((z) => (
                  <button
                    key={z}
                    onClick={() => {
                      setZonaActiva(z)
                      setMesaNum(1)
                    }}
                    className={`py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider border transition ${
                      zonaActiva === z
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-[#0f1115] text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>

              <span className="text-[9px] uppercase font-bold text-stone-500 tracking-widest text-center mt-2">
                Mesas
              </span>
              <div className="flex-1 grid grid-cols-1 gap-1.5 overflow-y-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => {
                  const clave = `${zonaActiva}-${m}`
                  const tieneItems = ticketsPorMesa[clave] && ticketsPorMesa[clave].length > 0
                  return (
                    <button
                      key={m}
                      onClick={() => setMesaNum(m)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-between px-3 ${
                        mesaNum === m
                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                          : 'bg-[#0f1115] text-stone-300 border-stone-800 hover:bg-stone-900'
                      }`}
                    >
                      <span>Mesa {m}</span>
                      {tieneItems && (
                        <span className={`w-1.5 h-1.5 rounded-full ${mesaNum === m ? 'bg-stone-950' : 'bg-amber-400'}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PLANTILLA DE IMPRESIÓN SOBERBIA */}
      <div id="ticket-print">
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '14px', letterSpacing: '2px' }}>JORCO FUSIÓN</h2>
          <p style={{ margin: 0, fontSize: '9px', textTransform: 'uppercase' }}>Gourmet Experience</p>
        </div>
        <p style={{ margin: '2px 0' }}><strong>Ubicación:</strong> {zonaActiva} — Mesa {mesaNum}</p>
        {notaActual && <p style={{ margin: '2px 0' }}><strong>Cliente:</strong> {notaActual}</p>}
        <hr style={{ borderStyle: 'dashed', margin: '8px 0' }} />
        {ticketActual.map((i) => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
            <span>{i.cantidad}x {i.nombre}</span>
            <span>{(i.precio * i.cantidad).toFixed(2)}€</span>
          </div>
        ))}
        <hr style={{ borderStyle: 'dashed', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
          <span>TOTAL</span>
          <span>{calcularTotal().toFixed(2)}€</span>
        </div>
        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '9px' }}>Gracias por su visita</p>
      </div>
    </>
  )
}
