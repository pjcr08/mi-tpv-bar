'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PantallaBarra() {
  const [comandas, setComandas] = useState([])
  const [cargando, setCargando] = useState(true)

  // Cargar comandas pendientes cuyo destino sea 'barra'
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
        .order('created_at', { ascending: true }) // Usa 'created_at' con guion bajo

      if (error) {
        console.error('Error cargando barra:', error.message)
        return
      }

      setComandas(data || [])
    } catch (err) {
      console.error('Excepción en barra:', err)
    } finally {
      setCargando(false)
    }
  }

  // Marcar una línea de comanda como 'listo'
  const marcarComoListo = async (idLinea) => {
    try {
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'listo' })
        .eq('id', idLinea)

      if (error) {
        alert(`Error al actualizar estado: ${error.message}`)
        return
      }

      // Actualizar vista local
      setComandas((prev) => prev.filter((item) => item.id !== idLinea))
    } catch (e) {
      console.error('Error al completar pedido:', e)
    }
  }

  useEffect(() => {
    cargarComandasBarra()

    // Suscripción en tiempo real a la tabla lineas_pedido
    const channel = supabase
      .channel('realtime-barra')
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans select-none">
      {/* CABECERA */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍹</span>
          <h1 className="text-2xl font-black text-amber-500 uppercase tracking-wider">
            PANTALLA DE BARRA
          </h1>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-xl text-amber-400 font-extrabold text-sm">
          Pendientes: {comandas.length}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {comandas.map((item) => {
            const mesa = item.pedidos?.mesas
            const nota = item.pedidos?.nota

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-amber-500/50 transition-all"
              >
                <div>
                  {/* CABECERA TARJETA */}
                  <div className="flex justify-between items-start pb-2 border-b border-slate-800 mb-3">
                    <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg uppercase">
                      {mesa ? `${mesa.zona} - Mesa ${mesa.numero}` : 'Mesa S/N'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  {/* PRODUCTO Y CANTIDAD */}
                  <div className="flex items-center gap-3 my-2">
                    <span className="text-2xl font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                      {item.cantidad}x
                    </span>
                    <span className="text-lg font-extrabold text-slate-100 leading-tight">
                      {item.producto_nombre}
                    </span>
                  </div>

                  {/* NOTA O ALIAS DEL CLIENTE */}
                  {nota && (
                    <div className="mt-2 bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs text-amber-300 font-semibold">
                      👤 {nota}
                    </div>
                  )}
                </div>

                {/* BOTÓN DESPACHAR / LISTO */}
                <button
                  onClick={() => marcarComoListo(item.id)}
                  className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl transition active:scale-95 shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Marcar como Listo</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
