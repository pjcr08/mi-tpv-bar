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
      alert('🚀 Comanda enviada')
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
      alert('💳 Cobro realizado')
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
          #ticket-print { position: absolute; left: 0; top: 0; width: 80mm; font-family: monospace; }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      <div className="h-screen w-screen bg-slate-200 text-slate-800 flex flex-col font-sans select-none overflow-hidden no-imprimir text-xs">
        
        {/* PANEL PRINCIPAL */}
        <div className="flex-1 flex overflow-hidden p-1 gap-1">
          
          {/* COLUMNA IZQUIERDA: TICKET Y CONTROL */}
          <div className="w-5/12 flex flex-col gap-1 bg-emerald-800/10 p-1 rounded border border-emerald-700/30">
            
            {/* BOTONES SUPERIORES MESA / CLIENTE */}
            <div className="grid grid-cols-4 gap-1">
              <button className="bg-emerald-700 text-white font-bold py-1.5 rounded text-[11px] hover:bg-emerald-800 flex flex-col items-center">
                <span>👤</span>
                <span>Asignar cliente</span>
              </button>
              <div className="bg-white border border-slate-300 rounded p-1 flex flex-col gap-0.5 text-[10px]">
                <input
                  type="text"
                  placeholder="Alias Cliente"
                  value={notaActual}
                  onChange={(e) => handleNotaChange(e.target.value)}
                  className="w-full bg-slate-100 px-1 py-0.5 border rounded focus:outline-none"
                />
                <div className="flex justify-between font-bold text-emerald-800">
                  <span>Mesa: {mesaNum}</span>
                  <span>{zonaActiva}</span>
                </div>
              </div>
              <button className="bg-emerald-700 text-white font-bold py-1.5 rounded text-[11px] hover:bg-emerald-800 flex flex-col items-center">
                <span>👥</span>
                <span>Comensales</span>
              </button>
              <button onClick={enviarComanda} className="bg-emerald-600 text-white font-bold py-1.5 rounded text-[11px] hover:bg-emerald-700 flex flex-col items-center">
                <span>📌</span>
                <span>Aparcar</span>
              </button>
            </div>

            {/* TABLA TICKET */}
            <div className="flex-1 bg-white border border-slate-300 rounded overflow-y-auto flex flex-col justify-between">
              <table className="w-full text-left border-collapse">
                <thead className="bg-emerald-800 text-white text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="p-1">Artículo</th>
                    <th className="p-1 text-center">Dto.</th>
                    <th className="p-1 text-center">Uds.</th>
                    <th className="p-1 text-right">Imp.</th>
                    <th className="p-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold">
                  {ticketActual.map((item) => (
                    <tr key={item.id} className="hover:bg-amber-50">
                      <td className="p-1 truncate max-w-[100px]">{item.nombre}</td>
                      <td className="p-1 text-center text-slate-400">0%</td>
                      <td className="p-1 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => cambiarCantidadItem(item.id, -1)} className="px-1 bg-slate-200 rounded">-</button>
                          <span>{item.cantidad}</span>
                          <button onClick={() => cambiarCantidadItem(item.id, 1)} className="px-1 bg-slate-200 rounded">+</button>
                        </div>
                      </td>
                      <td className="p-1 text-right">{Number(item.precio).toFixed(2)}</td>
                      <td className="p-1 text-right text-emerald-700">{(item.precio * item.cantidad).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* BARRA DE TOTALES */}
              <div className="bg-slate-100 border-t border-slate-300 p-1 flex justify-between items-center font-black">
                <span className="text-slate-600">ARTÍCULOS: {ticketActual.reduce((acc, i) => acc + i.cantidad, 0)}</span>
                <span className="text-base text-emerald-800">TOTAL: {calcularTotal().toFixed(2)} €</span>
              </div>
            </div>

            {/* BOTONERA ACCIONES Y TECLADO */}
            <div className="flex gap-1">
              {/* BOTONES ACCION LATERAL */}
              <div className="w-1/2 grid grid-cols-2 gap-1 text-[10px]">
                <button className="bg-emerald-700 text-white p-1 rounded font-bold hover:bg-emerald-800">Cons. propio</button>
                <button onClick={() => setTicketsPorMesa((prev) => ({ ...prev, [claveMesaActual]: [] }))} className="bg-rose-600 text-white p-1 rounded font-bold hover:bg-rose-700">Borrar cuenta</button>
                <button className="bg-emerald-700 text-white p-1 rounded font-bold hover:bg-emerald-800">Dividir pagos</button>
                <button className="bg-emerald-700 text-white p-1 rounded font-bold hover:bg-emerald-800">Camarero</button>
                <button onClick={cobrarEImprimir} className="bg-emerald-700 text-white p-1 rounded font-bold hover:bg-emerald-800">Último doc.</button>
                <button onClick={() => window.print()} className="bg-emerald-700 text-white p-1 rounded font-bold hover:bg-emerald-800">Proforma</button>
              </div>

              {/* KEYPAD */}
              <div className="w-1/2 grid grid-cols-3 gap-1 bg-slate-300 p-1 rounded">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, 'C'].map((n) => (
                  <button
                    key={n}
                    onClick={() => presionarTeclado(n)}
                    className="bg-white border border-slate-400 font-black py-1 rounded text-sm hover:bg-slate-100 active:bg-slate-200"
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* BOTÓN COBRAR */}
              <button
                onClick={cobrarEImprimir}
                className="w-16 bg-orange-500 hover:bg-orange-600 text-white font-black rounded flex flex-col items-center justify-center text-sm shadow uppercase"
              >
                <span>Cobrar</span>
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: PRODUCTOS, FAMILIAS Y ZONAS */}
          <div className="w-7/12 flex gap-1">
            
            {/* PANEL FAMILIAS Y PRODUCTOS */}
            <div className="flex-1 flex flex-col gap-1">
              
              {/* FAMILIAS (ARRIBA) */}
              <div className="grid grid-cols-6 gap-1 bg-slate-300 p-1 rounded max-h-28 overflow-y-auto">
                {familias.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFamiliaActiva(f)}
                    className={`p-1 font-bold text-[10px] rounded border uppercase truncate ${
                      familiaActiva === f ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* GRID PRODUCTOS */}
              <div className="flex-1 grid grid-cols-4 gap-1 bg-slate-100 border border-slate-300 p-1 rounded overflow-y-auto">
                {productosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarAlTicket(p)}
                    className="bg-white border border-slate-300 hover:border-emerald-600 rounded p-1 flex flex-col justify-between items-center h-16 shadow-sm active:scale-95 transition"
                  >
                    <span className="font-extrabold text-[11px] text-slate-800 uppercase line-clamp-2 text-center">
                      {p.nombre}
                    </span>
                    <span className="font-black text-emerald-700 text-xs">
                      {Number(p.precio).toFixed(2)} €
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* BARRA DE ZONAS Y MESAS (DERECHA) */}
            <div className="w-24 bg-slate-300 p-1 rounded flex flex-col gap-1">
              <div className="bg-emerald-800 text-white font-bold text-center py-1 rounded text-[10px] uppercase">
                Zonas
              </div>
              {['Barra', 'Salón', 'Terraza'].map((z) => (
                <button
                  key={z}
                  onClick={() => setZonaActiva(z)}
                  className={`py-2 px-1 font-bold rounded border text-[10px] uppercase ${
                    zonaActiva === z ? 'bg-emerald-700 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {z}
                </button>
              ))}

              <div className="mt-2 bg-emerald-800 text-white font-bold text-center py-1 rounded text-[10px] uppercase">
                Mesa
              </div>
              <div className="flex-1 grid grid-cols-1 gap-1 overflow-y-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMesaNum(m)}
                    className={`py-1.5 font-black rounded border text-[11px] ${
                      mesaNum === m ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    Mesa {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA ESTADO */}
        <footer className="bg-emerald-800 text-white px-2 py-0.5 flex justify-between text-[10px] font-bold">
          <div>TPV ACTIVO | ZONA: {zonaActiva} | MESA: {mesaNum}</div>
          <div>ESTADO: EN LÍNEA</div>
        </footer>
      </div>

      {/* PLANTILLA DE IMPRESIÓN */}
      <div id="ticket-print">
        <h2 style={{ textAlign: 'center', margin: 0 }}>JORCO FUSIÓN</h2>
        <p style={{ textAlign: 'center' }}>TICKET DE COMPRA</p>
        <p>Mesa: {mesaNum} ({zonaActiva})</p>
        {notaActual && <p>Cliente: {notaActual}</p>}
        <hr />
        {ticketActual.map((i) => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{i.cantidad}x {i.nombre}</span>
            <span>{(i.precio * i.cantidad).toFixed(2)}€</span>
          </div>
        ))}
        <hr />
        <h3 style={{ textAlign: 'right' }}>TOTAL: {calcularTotal().toFixed(2)}€</h3>
      </div>
    </>
  )
}
