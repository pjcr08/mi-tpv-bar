'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PantallaCocina() {
  const [comandas, setComandas] = useState([])
  const [cargando, setCargando] = useState(true)

  // Cargar comandas pendientes cuyo destino sea 'cocina' y agrupar por pedido_id
  const cargarComandasCocina = async () => {
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
        .eq('destino', 'cocina')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error cargando cocina:', error.message)
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
      console.error('Excepción en cocina:', err)
    } finally {
      setCargando(false)
    }
  }

  // Marcar una sola plato/línea como 'listo'
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

      cargarComandasCocina()
    } catch (e) {
      console.error('Error al completar plato:', e)
    }
  }

  // Marcar TODOS los platos de la mesa como 'listo'
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

      cargarComandasCocina()
    } catch (e) {
      console.error('Error al completar comanda entera:', e)
    }
  }

  useEffect(() => {
    cargarComandasCocina()

    // Suscripción en tiempo real a la tabla lineas_pedido
    const channel = supabase
      .channel('realtime-cocina-agrupado')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          cargarComandasCocina()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalPlatosPendientes = comandas.reduce(
    (acc, grupo) => acc + grupo.lineas.reduce((sum, l) => sum + l.cantidad, 0),
    0
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 font-sans select-none antialiased">
      {/* CABECERA COCINA */}
      <header className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 mb-6 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👨‍🍳</span>
          <div>
            <h1 className="text-2xl font-black text-rose-500 uppercase tracking-wider">
              PANTALLA DE COCINA
            </h1>
            <p className="text-xs text-neutral-400 font-medium">Comandas de pase agrupadas por mesa</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded-xl text-neutral-300 font-bold text-xs flex items-center">
            Mesas: {comandas.length}
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 px-4 py-1.5 rounded-xl text-rose-400 font-extrabold text-sm flex items-center">
            Platos: {totalPlatosPendientes}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      {cargando ? (
        <div className="text-center text-neutral-500 my-20 font-bold">
          Cargando comandas de cocina...
        </div>
      ) : comandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center my-28 text-neutral-600">
          <span className="text-5xl mb-3">🔥</span>
          <p className="text-lg font-bold">Sin platos pendientes en cocina</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {comandas.map((grupo) => {
            const mesa = grupo.mesa
            const nota = grupo.nota

            return (
              <div
                key={grupo.pedidoId}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-rose-500/40 transition-all"
              >
                <div>
                  {/* CABECERA MESA */}
                  <div className="flex justify-between items-start pb-3 border-b border-neutral-800 mb-3">
                    <span className="bg-rose-600 text-white font-black text-xs px-3 py-1 rounded-lg uppercase tracking-wider">
                      {mesa ? `${mesa.zona} — Mesa ${mesa.numero}` : 'Mesa S/N'}
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/60 border border-rose-900 px-2 py-0.5 rounded-md">
                      🕒 {grupo.horaMasAntigua
                        ? new Date(grupo.horaMasAntigua).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  {/* ALIAS / OBSERVACIONES DE LA MESA */}
                  {nota && (
                    <div className="mb-3 bg-neutral-950 p-2.5 rounded-xl border border-amber-500/30 text-xs text-amber-300 font-bold flex items-center gap-1.5">
                      <span>📝</span>
                      <span>{nota}</span>
                    </div>
                  )}

                  {/* LISTADO DE PLATOS */}
                  <div className="space-y-2 my-2">
                    {grupo.lineas.map((linea) => (
                      <div
                        key={linea.id}
                        className="flex items-center justify-between bg-neutral-950/80 border border-neutral-800 p-2.5 rounded-xl hover:border-neutral-700 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-black text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-lg border border-rose-500/20">
                            {linea.cantidad}x
                          </span>
                          <span className="text-sm font-extrabold text-neutral-100">
                            {linea.producto_nombre}
                          </span>
                        </div>

                        {/* Botón marchar/completar plato individual */}
                        <button
                          onClick={() => marcarLineaComoListo(linea.id)}
                          title="Marcar plato listo"
                          className="w-7 h-7 bg-emerald-950/60 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg flex items-center justify-center font-bold text-xs transition active:scale-90"
                        >
                          ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BOTÓN DESPACHAR PASE COMPLETO */}
                <button
                  onClick={() => marcarPedidoCompletoComoListo(grupo.lineas)}
                  className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl transition active:scale-95 shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
                >
                  <span>🍳</span>
                  <span>Marchado / Pase Completo</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
