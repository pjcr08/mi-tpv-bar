'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PantallaBarra() {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarComandas = async () => {
    try {
      const { data, error } = await supabase
        .from('lineas_pedido')
        .select(`
          *,
          pedidos (
            id,
            mesa_id,
            mesas (
              numero,
              zona
            )
          )
        `)
        .eq('destino', 'barra')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true }); // Muestra las bebidas más antiguas primero

      if (error) {
        console.error('Error al cargar comandas de barra:', error);
        return;
      }

      if (data) setComandas(data);
    } catch (err) {
      console.error('Error en la petición:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarComandas();

    // Suscripción en Tiempo Real con Supabase
    const canal = supabase
      .channel('realtime_barra')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          cargarComandas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const marcarListo = async (id) => {
    // 1. Respuesta visual instantánea (elimina de la pantalla)
    setComandas((prev) => prev.filter((item) => item.id !== id));

    // 2. Actualización en Supabase
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'listo' })
      .eq('id', id);

    if (error) {
      console.error('Error al marcar servido:', error);
      cargarComandas(); // Si falla, vuelve a recargar
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-black text-cyan-400 flex items-center gap-2">
          🍺 PANTALLA BARRA
        </h1>
        <span className="bg-slate-800 text-cyan-400 font-bold px-4 py-2 rounded-xl text-sm border border-slate-700">
          Pendientes: {comandas.length}
        </span>
      </div>

      {/* ESTADO DE CARGA O LISTA VACÍA */}
      {loading ? (
        <div className="flex justify-center items-center h-64 text-slate-500 font-bold text-lg">
          Cargando comandas de barra...
        </div>
      ) : comandas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
          <span className="text-4xl mb-2">🍹</span>
          <p className="text-xl font-bold">¡Barra limpia!</p>
          <p className="text-sm">No hay bebidas ni cafés pendientes de servir.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {comandas.map((item) => {
            // Lectura segura del número y zona de mesa
            const numeroMesa =
              item.pedidos?.mesas?.numero ||
              item.pedidos?.mesa_id ||
              '?';
            const zonaMesa = item.pedidos?.mesas?.zona || 'Barra';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border-2 border-cyan-500/40 p-5 rounded-2xl flex flex-col justify-between shadow-xl hover:border-cyan-400 transition"
              >
                <div>
                  <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                    <span className="bg-cyan-400 text-slate-950 px-3 py-1 rounded-full font-extrabold text-sm uppercase">
                      Mesa {numeroMesa}
                    </span>
                    <span className="text-xs text-slate-400 capitalize font-bold">
                      {zonaMesa}
                    </span>
                  </div>

                  <p className="text-2xl font-black text-white mt-2 leading-tight">
                    {item.producto_nombre || item.producto}
                  </p>

                  <div className="mt-3 bg-slate-950 p-2 rounded-xl border border-slate-800 inline-block">
                    <span className="text-cyan-400 font-black text-xl">
                      x{item.cantidad || 1}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => marcarListo(item.id)}
                  className="mt-6 w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-xl text-lg uppercase transition shadow-lg flex items-center justify-center gap-2"
                >
                  ✅ SERVIDO
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
