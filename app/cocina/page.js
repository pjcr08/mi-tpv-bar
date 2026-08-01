'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function CocinaView() {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarPedidosCocina()

    // Suscripción en tiempo real a la cocina
    const channel = supabase
      .channel('cocina-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarPedidosCocina()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarPedidosCocina()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const cargarPedidosCocina = async () => {
    try {
      // 1. Obtener pedidos abiertos
      const { data: pedidosData, error: pedidosErr } = await supabase
        .from('pedidos')
        .select(`
          id,
          nota,
          created_at,
          mesas (
            zona,
            numero,
            nombre_custom
          )
        `)
        .eq('estado', 'abierto')
        .order('created_at', { ascending: true })

      if (pedidosErr) throw pedidosErr

      if (!pedidosData || pedidosData.length === 0) {
        setPedidos([])
        setCargando(false)
        return
      }

      // 2. Obtener las líneas de pedido destinadas a cocina o pendients
      const pedidoIds = pedidosData.map((p) => p.id)
      const { data: lineasData, error: lineasErr } = await supabase
        .from('lineas_pedido')
        .select('*')
        .in('pedido_id', pedidoIds)
        .eq('destino', 'cocina')

      if (lineasErr) throw lineasErr

      // 3. Agrupar líneas con sus respectivos pedidos
      const pedidosConLineas = pedidosData
        .map((ped) => {
          const lineas = (lineasData || []).filter((l) => l.pedido_id === ped.id)
          return { ...ped, lineas }
        })
        .filter((ped) => ped.lineas.length > 0) // Mostrar solo los que tengan productos de cocina

      setPedidos(pedidosConLineas)
    } catch (err) {
      console.error('Error cargando cocina:', err)
    } finally {
      setCargando(false)
    }
  }

  // Marcar una línea individual como lista
  const toggleLineaEstado = async (lineaId, estadoActual) => {
    const nuevoEstado = estadoActual === 'listo' ? 'pendiente' : 'listo'
    setPedidos((prev) =>
      prev.map((p) => ({
        ...p,
        lineas: p.lineas.map((l) => (l.id === lineaId ? { ...l, estado: nuevoEstado } : l)),
      }))
    )

    await supabase.from('lineas_pedido').update({ estado: nuevoEstado }).eq('id', lineaId)
  }

  // Marcar toda la comanda como lista
  const completarPedido = async (pedidoId) => {
    setPedidos((prev) => prev.filter((p) => p.id !== pedidoId))
    await supabase.from('lineas_pedido').update({ estado: 'listo' }).eq('pedido_id', pedidoId).eq('destino', 'cocina')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans select-none">
      <header className="flex justify-between items-center mb-6 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👨‍🍳</span>
          <div>
            <h1 className="text-xl font-black text-amber-500 tracking-wider">COMANDAS DE COCINA</h1>
            <p className="text-xs text-slate-400 font-medium">Pedidos entrantes en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-bold text-slate-300">{pedidos.length} Activas</span>
        </div>
      </header>

      {cargando ? (
        <div className="text-center py-20 text-slate-500 text-sm">Cargando comandas...</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-20 text-slate-500 font-bold text-sm">
          🎉 ¡Todo al día! No hay marchas pendientes en cocina.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pedidos.map((ped) => {
            const nombreMesa = ped.mesas?.nombre_custom || `Mesa ${ped.mesas?.numero || ''}`
            const zona = ped.mesas?.zona || 'Terraza'
            const hora = ped.created_at
              ? new Date(ped.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '--:--'
            const todoListo = ped.lineas.every((l) => l.estado === 'listo')

            return (
              <div
                key={ped.id}
                className={`bg-slate-900 border-2 rounded-2xl p-4 flex flex-col justify-between shadow-xl transition-all ${
                  todoListo ? 'border-emerald-500/50 bg-slate-900/60' : 'border-amber-500/80'
                }`}
              >
                <div>
                  {/* CABECERA CON ZONA, MESA Y ALIAS DEL CLIENTE */}
                  <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-black text-amber-500 text-base uppercase block tracking-wide">
                        {zona.toUpperCase()} - {nombreMesa}
                      </span>
                      {/* 🔴 ALIAS DEL CLIENTE (PEPITO, GORRA ROJA, ETC) */}
                      {ped.nota && (
                        <span className="inline-block mt-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md text-xs font-black">
                          👤 {ped.nota}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                      ⏱️ {hora}
                    </span>
                  </div>

                  {/* LISTA DE PLATOS */}
                  <div className="space-y-2 mb-4">
                    {ped.lineas.map((linea) => {
                      const esListo = linea.estado === 'listo'
                      return (
                        <button
                          key={linea.id}
                          onClick={() => toggleLineaEstado(linea.id, linea.estado)}
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition active:scale-95 ${
                            esListo
                              ? 'bg-slate-950/40 border-slate-800 text-slate-500 line-through'
                              : 'bg-slate-950 border-slate-800 text-slate-100 font-bold hover:border-amber-500/40'
                          }`}
                        >
                          <span className="text-xs">
                            <strong className="text-amber-400 mr-1.5">{linea.cantidad}x</strong>
                            {linea.producto_nombre}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center border ${
                              esListo
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {esListo ? '✓' : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* BOTÓN COMPLETAR TODO */}
                <button
                  onClick={() => completarPedido(ped.id)}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 ${
                    todoListo
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span>✓ LISTA COMPLETA</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
