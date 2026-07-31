'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'

export default function CocinaPage() {
  const [comandas, setComandas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Función para obtener las comandas de la cocina
  const fetchComandasCocina = async () => {
    try {
      const { data, error } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('destino', 'cocina')
        .eq('servido', false)
        .order('creado_en', { ascending: true });

      if (error) {
        console.error('Error cargando comandas de cocina:', error.message);
      } else {
        setComandas(data || []);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchComandasCocina();

    // Suscripción Realtime a nuevas líneas de pedido
    const channel = supabase
      .channel('realtime_cocina')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lineas_pedido' },
        (payload) => {
          console.log('Nuevo item recibido en realtime:', payload.new);
          // Si el item recibido va destinado a la cocina y no está servido, lo añadimos
          if (payload.new.destino === 'cocina' && !payload.new.servido) {
            setComandas((prev) => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Marcar una comanda como lista/servida
  const marcarServido = async (id) => {
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ servido: true })
      .eq('id', id);

    if (!error) {
      setComandas((prev) => prev.filter((item) => item.id !== id));
    } else {
      console.error('Error al actualizar estado:', error.message);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#e67e22', margin: 0 }}>👨‍🍳 COMANDAS DE COCINA</h1>
        <button 
          onClick={fetchComandasCocina}
          style={{ padding: '8px 16px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
        >
          🔄 Recargar
        </button>
      </div>

      {cargando ? (
        <p>Cargando comandas...</p>
      ) : comandas.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#1e1e1e', borderRadius: '8px', border: '1px dashed #444' }}>
          <h2>No hay comanda pendiente en cocina</h2>
          <p style={{ color: '#888' }}>Envía un pedido marcado para cocina desde la pantalla principal para probar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {comandas.map((item) => (
            <div key={item.id} style={{ border: '2px solid #e67e22', borderRadius: '8px', padding: '15px', background: '#1e1e1e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', color: '#e67e22' }}>
                  Mesa / Pedido: {item.pedido_id ? String(item.pedido_id).substring(0, 8) : 'S/N'}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                  {new Date(item.creado_en).toLocaleTimeString([], { hour: '22-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '15px 0' }}>
                {item.cantidad}x {item.nombre_producto}
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
                ✔ MARCAR LISTO
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
