'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PantallaBarra() {
  const [comandas, setComandas] = useState([])

  const cargarComandasBarra = async () => {
    try {
      const { data, error } = await supabase
        .from('lineas_pedido')
        .select(`
          id,
          producto_nombre,
          cantidad,
          created_at,
          pedidos (
            nota,
            mesas ( zona, numero, nombre_custom )
          )
        `)
        .eq('destino', 'barra')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })

      if (error) console.error('Error cargando barra:', error)
      else setComandas(data || [])
    } catch (err) {
      console.error('Excepción cargando barra:', err)
    }
  }

  useEffect(() => {
    cargarComandasBarra()

    // Suscripción Realtime a cambios en líneas de pedido
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

  const marcarCompletado = async (id) => {
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'listo' })
      .eq('id', id)

    if (error) {
      alert(`Error al actualizar estado: ${error.message}`)
    } else {
      setComandas((prev) => prev.filter((item) => item.id !== id))
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="flex justify-between items-center pb-6 border-b border-slate-800 mb-6">
        <h1 className="text-2xl font-black text-amber-500 flex items-center gap-2 uppercase tracking-wider">
          <span>🍹</span> Pantalla de Barra
        </h1>
        <span className="bg-slate-900 border border-slate-800 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs">
          Pendientes: <strong className="text-amber-400 text-base">{comandas.length}</strong>
        </span>
      </header>

      {comandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 text-slate-600">
          <span className="text-5xl mb-2">✨</span>
          <p className="text-lg font-bold">Sin bebidas ni cafés pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {comandas.map((item) => {
            const mesaInfo = item.pedidos?.mesas
            const nombreMesa = mesaInfo?.nombre_custom || `Mesa ${mesaInfo?.numero || '?'}`
            const zona = mesaInfo?.zona || 'Barra'
            const nota = item.pedidos?.nota

            return (
              <div
                key={item.id}
                onClick={() => marcarCompletado(item.id)}
                className="bg-slate-900 border-2 border-amber-500/40 hover:border-amber-500 rounded-2xl p-4 flex flex-col justify-between shadow-xl cursor-pointer active:scale-95 transition group"
              >
                <div>
                  {/* CABECERA CON MESA Y ZONA */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                    <span className="font-black text-amber-400 text-sm uppercase">
                      📍 {zona} - {nombreMesa}
                    </span>
                    <span className="text-[10px] bg-slate-950 text-slate-400 font-bold px-2 py-1 rounded-md border border-slate-800">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* NOTA DEL CLIENTE SI EXISTE */}
                  {nota && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg mb-3">
                      👤 {nota}
                    </div>
                  )}

                  {/* PRODUCTO Y CANTIDAD */}
                  <div className="flex items-center gap-3 my-2">
                    <span className="bg-amber-500 text-slate-950 font-black text-lg px-3 py-1 rounded-xl">
                      {item.cantidad || 1}x
                    </span>
                    <h2 className="font-black text-base text-slate-100 uppercase group-hover:text-amber-400 transition">
                      {item.producto_nombre}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-800/80 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-emerald-400 transition">
                  Toca para servir ➔
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
