'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'

export default function BarraPage() {
  const [comandas, setComandas] = useState([]);

  const fetchComandasBarra = async () => {
    const { data, error } = await supabase
      .from('lineas_pedido')
      .select('*, pedidos(mesa_id)')
      .eq('destino', 'barra')
      .eq('servido', false)
      .order('creado_en', { ascending: true });

    if (error) console.error('Error cargando barra:', error);
    else setComandas(data || []);
  };

  useEffect(() => {
    fetchComandasBarra();

    const channel = supabase
      .channel('realtime_barra')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lineas_pedido' },
        (payload) => {
          if (payload.new.destino === 'barra') {
            fetchComandasBarra();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      <h1 style={{ color: '#3498db', fontSize: '2rem' }}>🍹 COMANDAS BARRA</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
        {comandas.length === 0 ? (
          <p>No hay bebidas pendientes en barra.</p>
        ) : (
          comandas.map((item) => (
            <div key={item.id} style={{ border: '2px solid #3498db', borderRadius: '8px', padding: '15px', background: '#1e1e1e' }}>
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
                ✔ MARCAR SERVIDO
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
