'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'

export default function CocinaPage() {
  const [comandas, setComandas] = useState([]);

  // Cargar comandas pendientes de cocina
  const fetchComandasCocina = async () => {
    const { data, error } = await supabase
      .from('lineas_pedido')
      .select('*, pedidos(mesa_id)')
      .eq('destino', 'cocina')
      .eq('servido', false)
      .order('creado_en', { ascending: true });

    if (error) console.error('Error cargando cocina:', error);
    else setComandas(data || []);
  };

  useEffect(() => {
    fetchComandasCocina();

    // Escuchar comandas entrantes en tiempo real
    const channel = supabase
      .channel('realtime_cocina')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lineas_pedido' },
        (payload) => {
          if (payload.new.destino === 'cocina') {
            fetchComandasCocina(); // Recargamos para traer la relación con la mesa
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Marcar plato como preparado/servido
  const marcarServido = async (id) => {
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ servido: true })
      .eq('id', id);

    if (!error) {
      setComandas((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#e67e22', fontSize: '2rem' }}>👨‍🍳 COMANDAS COCINA</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
        {comandas.length === 0 ? (
          <p>No hay platos pendientes en cocina.</p>
        ) : (
          comandas.map((item) => (
            <div key={item.id} style={{ border: '2px solid #e67e22', borderRadius: '8px', padding: '15px', background: '#1e1e1e' }}>
              <h2>Mesa: {item.pedidos?.mesa_id || 'S/N'}</h2>
              <p style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                {item.cantidad}x {item.nombre_producto}
              </p>
              <button
                onClick={() => marcarServido(item.id)}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✔ MARCAR LISTO
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
