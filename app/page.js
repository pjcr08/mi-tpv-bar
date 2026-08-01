'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TpvPrincipalView() {
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  const [aliasCliente, setAliasCliente] = useState('')
  const [comandaActual, setComandaActual] = useState([])
  const [mesasConPedido, setMesasConPedido] = useState([]) // Guarda qué mesas tienen comanda abierta
  const [productos, setProductos] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [familias, setFamilias] = useState([])

  const claveMesa = `${zonaActiva}-${mesaNum}`

  useEffect(() => {
    cargarProductos()
    cargarComandaServidor()
    cargarMesasActivas()

    // 🔴 REFRESA EN TIEMPO REAL CUANDO LA PDA MANDA UN PEDIDO
    const channel = supabase
      .channel('tpv-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarComandaServidor()
        cargarMesasActivas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarComandaServidor()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [zonaActiva, mesaNum])

  // Cargar comanda guardada en la BD para la mesa seleccionada
  const cargarComandaServidor = async () => {
    try {
      // 1. Obtener ID de la mesa
      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('zona', zonaActiva)
        .eq('numero', mesaNum)
        .maybeSingle()

      if (!mesaBD) {
        setComandaActual([])
        setAliasCliente('')
        return
      }

      // 2. Obtener pedido abierto
      const { data: pedidoBD } = await supabase
        .from('pedidos')
        .select('id, nota')
        .eq('mesa_id', mesaBD.id)
        .eq('estado', 'abierto')
        .maybeSingle()

      if (!pedidoBD) {
        setComandaActual([])
        setAliasCliente('')
        return
      }

      setAliasCliente(pedidoBD.nota || '')

      // 3. Cargar sus líneas
      const { data: lineas } = await supabase.from('lineas_pedido').select('*').eq('pedido_id', pedidoBD.id)

      if (lineas) {
        setComandaActual(
          lineas.map((l) => ({
            id: l.id,
            nombre: l.producto_nombre,
            precio: Number(l.precio),
            cantidad: l.cantidad,
            destino: l.destino,
          }))
        )
      }
    } catch (err) {
      console.error('Error cargando comanda en TPV:', err)
    }
  }

  // Cargar lista de todas las mesas ocupadas para marcar en el selector
  const cargarMesasActivas = async () => {
    try {
      const { data: pedidosAbiertos } = await supabase
        .from('pedidos')
        .select('mesas(zona, numero)')
        .eq('estado', 'abierto')

      if (pedidosAbiertos) {
        const claves = pedidosAbiertos
          .map((p) => (p.mesas ? `${p.mesas.zona}-${p.mesas.numero}` : null))
          .filter(Boolean)
        setMesasConPedido(claves)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const cargarProductos = async () => {
    try {
      const { data } = await supabase.from('productos').select('*')
      if (data && data.length > 0) {
        setProductos(data)
        const fams = [...new Set(data.map((p) => p.familia))]
        setFamilias(fams)
        setFamiliaActiva(fams[0])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const totalCalculado = comandaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)

  return (
    <div className="h-screen max-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* BARRA SUPERIOR DE ZONAS Y UBICACIÓN */}
      <header className="bg-amber-500 text-slate-950 p-2.5 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <span className="font-black text-sm tracking-wide uppercase">JORCO FUSIÓN TPV</span>
          <div className="flex gap-1 bg-slate-950/20 p-1 rounded-lg">
            {['Terraza', 'Salón', 'Barra'].map((z) => (
              <button
                key={z}
                onClick={() => setZonaActiva(z)}
                className={`px-3 py-1 rounded-md text-xs font-black uppercase transition ${
                  zonaActiva === z ? 'bg-slate-950 text-amber-400' : 'text-slate-950 hover:bg-slate-950/10'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* SELECTOR DE MESAS Y NOTA */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase">Mesa:</span>
          <select
            value={mesaNum}
            onChange={(e) => setMesaNum(Number(e.target.value))}
            className="bg-slate-950 text-amber-400 border border-slate-900 font-black rounded-lg text-xs px-3 py-1.5 focus:outline-none"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
              const estaOcupada = mesasConPedido.includes(`${zonaActiva}-${n}`)
              return (
                <option key={n} value={n}>
                  Mesa {n} {estaOcupada ? '🔴 (Ocupada)' : ''}
                </option>
              )
            })}
          </select>

          {/* MOSTRAR ALIAS SI SE ENVIÓ DESDE PDA */}
          {aliasCliente && (
            <div className="bg-slate-950 text-amber-300 font-bold px-3 py-1 rounded-lg text-xs border border-amber-400/30 flex items-center gap-1">
              <span>👤</span> {aliasCliente}
            </div>
          )}
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* PANEL IZQUIERDO: TICKET / COMANDA */}
        <div className="w-1/3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col p-3 shadow-inner">
          <div className="border-b border-slate-800 pb-2 mb-2 flex justify-between items-center">
            <span className="text-xs font-black uppercase text-slate-400">CANT / DESCRIPCIÓN</span>
            <span className="text-xs font-black uppercase text-slate-400">TOTAL</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {comandaActual.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                {zonaActiva} - Mesa {mesaNum} sin productos
              </div>
            ) : (
              comandaActual.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800/80 p-2.5 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-200 block">
                      <span className="text-amber-400 font-black mr-1">{item.cantidad}x</span>
                      {item.nombre}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">{item.precio.toFixed(2)}€/u</span>
                  </div>
                  <span className="font-black text-sm text-slate-100">
                    {(item.precio * item.cantidad).toFixed(2)}€
                  </span>
                </div>
              ))
            )}
          </div>

          {/* TOTAL A PAGAR */}
          <div className="border-t border-slate-800 pt-3 mt-2">
            <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded-xl flex justify-between items-center mb-2">
              <span className="text-xs font-black text-sky-400 uppercase">TOTAL A PAGAR</span>
              <span className="text-2xl font-black text-sky-400">{totalCalculado.toFixed(2)}€</span>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: PARRILLA DE PRODUCTOS */}
        <div className="w-2/3 flex flex-col gap-2">
          {/* FAMILIAS */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {familias.map((f) => (
              <button
                key={f}
                onClick={() => setFamiliaActiva(f)}
                className={`flex-1 py-2 rounded-xl font-black text-xs uppercase transition shadow-sm ${
                  familiaActiva === f
                    ? 'bg-slate-950 text-amber-400 border border-amber-500/50'
                    : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:bg-slate-950'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* BOTONES DE PRODUCTOS */}
          <div className="flex-1 grid grid-cols-4 gap-2 overflow-y-auto align-content-start">
            {productosFiltrados.map((p) => (
              <button
                key={p.id}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col justify-between h-24 text-left transition"
              >
                <div className="flex justify-between items-start w-full">
                  <span className="font-bold text-xs text-slate-200 line-clamp-2">{p.nombre}</span>
                  <span className="text-base">{p.img || '🍽️'}</span>
                </div>
                <div className="flex justify-between items-end w-full">
                  <span className="text-[9px] font-black uppercase text-slate-500">{p.destino}</span>
                  <span className="font-black text-xs text-amber-400">{Number(p.precio).toFixed(2)}€</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
