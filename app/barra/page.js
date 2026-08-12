'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PantallaBarra() {
  const [comandas, setComandas] = useState([])
  const [cargando, setCargando] = useState(true)

  // Cargar comandas pendientes y agruparlas por pedido_id
  const cargarComandasBarra = async () => {
    try {
      const { data, error } = await supabase
        .from('lineas_pedido')
        .select(`
          id,
          producto_nombre,
          cantidad,
          destino,
          estado,
          created_at,
          pedido_id,
          pedidos (
            id,
            nota,
            estado,
            mesas (
              numero,
              zona
            )
          )
        `)
        .eq('destino', 'barra')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error cargando barra:', error.message)
        return
      }

      // AGRUPACIÓN POR PEDIDO_ID
      const agrupadosMap = {}

      ;(data || []).forEach((linea) => {
        const pId = linea.pedido_id

        if (!agrupadosMap[pId]) {
          agrupadosMap[pId] = {
            pedidoId: pId,
            mesa: linea.pedidos?.mesas,
            nota: linea.pedidos?.nota,
            horaMasAntigua: linea.created_at,
            lineas: [],
          }
        }

        agrupadosMap[pId].lineas.push({
          id: linea.id,
          producto_nombre: linea.producto_nombre,
          cantidad: linea.cantidad,
          created_at: linea.created_at,
        })
      })

      // Convertir a array para renderizar
      setComandas(Object.values(agrupadosMap))
    } catch (err) {
      console.error('Excepción en barra:', err)
    } finally {
      setCargando(false)
    }
  }

  // Marcar una sola línea como 'listo'
  const marcarLineaComoListo = async (idLinea) => {
    try {
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'listo' })
        .eq('id', idLinea)

      if (error) {
        alert(`Error al actualizar estado: ${error.message}`)
        return
      }

      // Refrescar para reorganizar los grupos
      cargarComandasBarra()
    } catch (e) {
      console.error('Error al completar item:', e)
    }
  }

  // Marcar TODAS las líneas de la mesa/pedido como 'listo'
  const marcarPedidoCompletoComoListo = async (lineas) => {
    try {
      const ids = lineas.map((l) => l.id)

      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'listo' })
        .in('id', ids)

      if (error) {
        alert(`Error al actualizar estado: ${error.message}`)
        return
      }

      cargarComandasBarra()
    } catch (e) {
      console.error('Error al completar pedido completo:', e)
    }
  }

  useEffect(() => {
    cargarComandasBarra()

    const channel = supabase
      .channel('realtime-barra-agrupado')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          cargarComandasBarra()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalBebidasPendientes = comandas.reduce(
    (acc, grupo) => acc + grupo.lineas.reduce((sum, l) => sum + l.cantidad, 0),
    0
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans select-none antialiased">
      {/* CABECERA */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍹</span>
          <div>
            <h1 className="text-2xl font-black text-amber-500 uppercase tracking-wider">
              PANTALLA DE BARRA
            </h1>
            <p className="text-xs text-slate-400 font-medium">Comandas agrupadas por mesa</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-slate-300 font-bold text-xs flex items-center">
            Mesas: {comandas.length}
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-xl text-amber-400 font-extrabold text-sm flex items-center">
            Bebidas: {totalBebidasPendientes}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      {cargando ? (
        <div className="text-center text-slate-500 my-20 font-bold">
          Cargando comandas de barra...
        </div>
      ) : comandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center my-28 text-slate-600">
          <span className="text-5xl mb-3">✨</span>
          <p className="text-lg font-bold">Sin bebidas ni cafés pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {comandas.map((grupo) => {
            const mesa = grupo.mesa
            const nota = grupo.nota

            return (
              <div
                key={grupo.pedidoId}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-amber-500/40 transition-all"
              >
                <div>
                  {/* CABECERA MESA */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-800 mb-3">
                    <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-lg uppercase tracking-wider">
                      {mesa ? `${mesa.zona} — Mesa ${mesa.numero}` : 'Mesa S/N'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {grupo.horaMasAntigua
                        ? new Date(grupo.horaMasAntigua).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  {/* ALIAS O NOTA DEL CLIENTE */}
                  {nota && (
                    <div className="mb-3 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs text-amber-300 font-bold flex items-center gap-1.5">
                      <span>👤</span>
                      <span>{nota}</span>
                    </div>
                  )}

                  {/* LISTA DE LÍNEAS DE LA MESA */}
                  <div className="space-y-2 my-2">
                    {grupo.lineas.map((linea) => (
                      <div
                        key={linea.id}
                        className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                            {linea.cantidad}x
                          </span>
                          <span className="text-sm font-bold text-slate-100">
                            {linea.producto_nombre}
                          </span>
                        </div>

                        {/* Botón individual por producto */}
                        <button
                          onClick={() => marcarLineaComoListo(linea.id)}
                          title="Marcar solo esta bebida"
                          className="w-7 h-7 bg-emerald-950/60 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg flex items-center justify-center font-bold text-xs transition active:scale-90"
                        >
                          ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BOTÓN DESPACHAR TODO EL PEDIDO */}
                <button
                  onClick={() => marcarPedidoCompletoComoListo(grupo.lineas)}
                  className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl transition active:scale-95 shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Despachar Mesa Completa</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
