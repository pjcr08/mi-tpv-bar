'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function BarraPage() {
  const [comandas, setComandas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const fetchComandasBarra = async () => {
    try {
      const { data, error } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('destino', 'barra')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error cargando barra:', error.message);
      } else {
        setComandas(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchComandasBarra();

    const channel = supabase
      .channel('realtime_barra')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lineas_pedido' },
        (payload) => {
          if (payload.new.destino === 'barra' && payload.new.estado === 'pendiente') {
            setComandas((prev) => [...prev, payload.new]);
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
      .update({ estado: 'servido' })
      .eq('id', id);

    if (!error) {
      setComandas((prev) => prev.filter((item) => item.id !== id));
    } else {
      console.error('Error al actualizar estado:', error.message);
    }
  };

  const obtenerHora = (fechaIso) => {
    if (!fechaIso) return '---';
    const d = new Date(fechaIso);
    return isNaN(d.getTime()) ? '---' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#3498db', margin: 0 }}>🍹 COMANDAS DE BARRA</h1>
        <button 
          onClick={fetchComandasBarra}
          style={{ padding: '8px 16px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
        >
          🔄 Recargar
        </button>
      </div>

      {cargando ? (
        <p>Cargando comandas...</p>
      ) : comandas.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#1e1e1e', borderRadius: '8px', border: '1px dashed #444' }}>
          <h2>No hay bebidas pendientes en barra</h2>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {comandas.map((item) => (
            <div key={item.id} style={{ border: '2px solid #3498db', borderRadius: '8px', padding: '15px', background: '#1e1e1e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', color: '#3498db' }}>
                  Pedido ID: #{item.pedido_id}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#aaa' }}>
                  {obtenerHora(item.created_at)}
                </span>
              </div>
              
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '15px 0', color: '#fff' }}>
                {item.cantidad || 1}x {item.producto_nombre}
              </p>

              <button
                onClick={() => marcarServido(item.id)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                ✔ MARCAR SERVIDO
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
