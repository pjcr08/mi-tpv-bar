'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase';

export default function PantallaBarra() {
  const [comandas, setComandas] = useState([])

  useEffect(() => {
    cargarComandas()

    const canal = supabase
      .channel('realtime_barra')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lineas_pedido' },
        (payload) => {
          if (payload.new.destino === 'barra') {
            cargarComandas()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [])

  const cargarComandas = async () => {
    const { data } = await supabase
      .from('lineas_pedido')
      .select('*, pedidos(mesa_id, mesas(numero, zona))')
      .eq('destino', 'barra')
      .eq('estado', 'pendiente')

    if (data) setComandas(data)
  }

  const marcarListo = async (id) => {
    await supabase.from('lineas_pedido').update({ estado: 'listo' }).eq('id', id)
    cargarComandas()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-3xl font-black text-cyan-400 mb-6 border-b border-slate-800 pb-2">
        🍺 PANTALLA BARRA
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {comandas.map((item) => (
          <div key={item.id} className="bg-slate-900 border-2 border-cyan-500/40 p-5 rounded-2xl flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="bg-cyan-400 text-slate-950 px-3 py-1 rounded-full font-extrabold text-sm uppercase">
                  Mesa {item.pedidos?.mesas?.numero}
                </span>
                <span className="text-xs text-slate-400 capitalize">{item.pedidos?.mesas?.zona}</span>
              </div>
              <p className="text-2xl font-bold text-white mt-2">{item.producto_nombre}</p>
              <p className="text-slate-400 font-semibold text-lg">Cantidad: x{item.cantidad || 1}</p>
            </div>

            <button
              onClick={() => marcarListo(item.id)}
              className="mt-6 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-lg uppercase transition"
            >
              ✅ SERVIDO
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
