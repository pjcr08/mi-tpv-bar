'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BarraPage() {
  const [comandasAgrupadas, setComandasAgrupadas] = useState([])
  const [cargando, setCargando] = useState(true)

  const fetchComandasBarra = async () => {
    try {
      // 1. Obtener las líneas pendientes para barra
      const { data: lineas, error: errLineas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('destino', 'barra')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })

      if (errLineas) throw errLineas

      if (!lineas || lineas.length === 0) {
        setComandasAgrupadas([])
        setCargando(false)
        return
      }

      // 2. Extraer los IDs únicos de pedidos
      const pedidoIds = [...new Set(lineas.map((l) => l.pedido_id))]

      // 3. Consultar pedidos con relación a mesas
      const { data: pedidos, error: errPedidos } = await supabase
        .from('pedidos')
        .select(`
          id,
          mesas (
            numero,
            zona
          )
        `)
        .in('id', pedidoIds)

      if (errPedidos) throw errPedidos

      // 4. Mapear pedidos a su mesa correspondiente
      const mapaMesas = {}
      pedidos?.forEach((p) => {
        if (p.mesas) {
          const zona = p.mesas.zona ? p.mesas.zona.toUpperCase() : 'SALA'
          mapaMesas[p.id] = `${zona} - Mesa ${p.mesas.numero}`
        } else {
          mapaMesas[p.id] = `Pedido #${p.id}`
        }
      })

      // 5. Agrupar las líneas por comanda
      const grupos = {}
      lineas.forEach((linea) => {
        const pId = linea.pedido_id
        if (!grupos[pId]) {
          grupos[pId] = {
            pedido_id: pId,
            mesa: mapaMesas[pId] || `Pedido #${pId}`,
            hora: linea.created_at,
            items: [],
          }
        }
        grupos[pId].items.push(linea)
      })

      setComandasAgrupadas(Object.values(grupos))
    } catch (err) {
      console.error('Error cargando comanda de barra:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    fetchComandasBarra()

    const channel = supabase
      .channel('realtime_barra')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          fetchComandasBarra()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // 1. MARCAR COMANDA COMPLETA COMO SERVIDA
  const marcarComandaCompleta = async (pedidoId) => {
    setComandasAgrupadas((prev) => prev.filter((g) => g.pedido_id !== pedidoId))

    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'servido' })
      .eq('pedido_id', pedidoId)
      .eq('destino', 'barra')

    if (error) {
      console.error('Error en Supabase:', error.message)
      fetchComandasBarra()
    }
  }

  // 2. BORRAR/CANCELAR COMANDA DE BARRA
  const borrarComanda = async (pedidoId) => {
    if (!confirm('¿Seguro que quieres BORRAR esta comanda de barra?')) return

    setComandasAgrupadas((prev) => prev.filter((g) => g.pedido_id !== pedidoId))

    const { error } = await supabase
      .from('lineas_pedido')
      .delete()
      .eq('pedido_id', pedidoId)
      .eq('destino', 'barra')

    if (error) {
      console.error('Error al borrar comanda:', error.message)
      fetchComandasBarra()
    }
  }

  // 3. MARCAR UN SOLO ÍTEM COMO SERVIDO (Actualización local optimista)
  const marcarItemListo = async (id, pedidoId) => {
    setComandasAgrupadas((prev) =>
      prev
        .map((grupo) => {
          if (grupo.pedido_id !== pedidoId) return grupo
          const itemsFiltrados = grupo.items.filter((item) => item.id !== id)
          return { ...grupo, items: itemsFiltrados }
        })
        .filter((grupo) => grupo.items.length > 0)
    )

    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'servido' })
      .eq('id', id)

    if (error) {
      console.error('Error al marcar ítem servido:', error.message)
      fetchComandasBarra()
    }
  }

  const obtenerHora = (fechaIso) => {
    if (!fechaIso) return '--:--'
    const d = new Date(fechaIso)
    return isNaN(d.getTime())
      ? '--:--'
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans select-none">
      <header className="flex justify-between items-center mb-6 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍹</span>
          <div>
            <h1 className="text-xl font-black text-sky-400 tracking-wider">
              COMANDAS DE BARRA
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Bebidas y tragos pendientes
            </p>
          </div>
        </div>
        <button
          onClick={fetchComandasBarra}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 transition"
        >
          🔄 Recargar
        </button>
      </header>

      {cargando ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          Cargando bebidas...
        </div>
      ) : comandasAgrupadas.length === 0 ? (
        <div className="text-center py-20 text-slate-500 font-bold text-sm bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
          🥂 ¡Barra despejada! No hay bebidas pendientes.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {comandasAgrupadas.map((grupo) => (
            <div
              key={grupo.pedido_id}
              className="bg-slate-900 border-2 border-sky-500/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl"
            >
              <div>
                {/* CABECERA CON MESA Y HORA */}
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
                  <span className="font-black text-sky-400 text-base uppercase tracking-wide">
                    {grupo.mesa}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                    ⏱️ {obtenerHora(grupo.hora)}
                  </span>
                </div>

                {/* BEBIDAS */}
                <ul className="space-y-2 mb-4">
                  {grupo.items.map((item) => (
                    <li
                      key={item.id}
                      className="w-full p-2.5 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between text-left"
                    >
                      <span className="text-xs font-bold text-slate-100">
                        <strong className="text-sky-400 mr-1.5">
                          {item.cantidad || 1}x
                        </strong>
                        {item.producto_nombre}
                      </span>
                      <button
                        onClick={() => marcarItemListo(item.id, grupo.pedido_id)}
                        className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 font-black text-xs flex items-center justify-center transition active:scale-95"
                      >
                        ✓
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ACCIONES DEL PEDIDO */}
              <div className="flex gap-2">
                <button
                  onClick={() => marcarComandaCompleta(grupo.pedido_id)}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  ✓ SERVIR TODO
                </button>
                <button
                  onClick={() => borrarComanda(grupo.pedido_id)}
                  title="Borrar comanda"
                  className="px-3 py-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-black text-xs transition active:scale-95"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
