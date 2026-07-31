'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CocinaPage() {
  const [comandasAgrupadas, setComandasAgrupadas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Cargar y agrupar comandas por pedido y mesa
  const fetchComandasCocina = async () => {
    try {
      const { data, error } = await supabase
        .from('lineas_pedido')
        .select(`
          id,
          pedido_id,
          producto_nombre,
          cantidad,
          destino,
          estado,
          created_at,
          pedidos (
            id,
            mesa_id
          )
        `)
        .eq('destino', 'cocina')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error cargando cocina:', error.message);
      } else {
        agruparPorPedido(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  // Función para agrupar las líneas de pedido individuales por Pedido/Mesa
  const agruparPorPedido = (lineas) => {
    const grupos = {};

    lineas.forEach((linea) => {
      const pId = linea.pedido_id;
      if (!grupos[pId]) {
        grupos[pId] = {
          pedido_id: pId,
          mesa: linea.pedidos?.mesa_id || `Mesa #${pId}`,
          hora: linea.created_at,
          items: []
        };
      }
      grupos[pId].items.push(linea);
    });

    setComandasAgrupadas(Object.values(grupos));
  };

  useEffect(() => {
    fetchComandasCocina();

    // Sincronización en tiempo real
    const channel = supabase
      .channel('realtime_cocina')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          // Recargamos para refrescar la lista agrupada completa con los datos de mesas
          fetchComandasCocina();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Marcar toda la comanda de la mesa como lista
  const marcarComandaCompleta = async (items) => {
    const ids = items.map((i) => i.id);
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'listo' })
      .in('id', ids);

    if (!error) {
      fetchComandasCocina();
    } else {
      console.error('Error al actualizar comanda:', error.message);
    }
  };

  // Marcar un solo plato como listo
  const marcarItemListo = async (id) => {
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'listo' })
      .eq('id', id);

    if (!error) {
      fetchComandasCocina();
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
        <h1 style={{ color: '#e67e22', margin: 0, fontSize: '2rem' }}>👨‍🍳 COMANDAS DE COCINA</h1>
        <button 
          onClick={fetchComandasCocina}
          style={{ padding: '10px 18px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🔄 Recargar
        </button>
      </div>

      {cargando ? (
        <p>Cargando comandas...</p>
      ) : comandasAgrupadas.length === 0 ? (
        <div style={{ padding: '50px', textAlign: 'center', background: '#1e1e1e', borderRadius: '8px', border: '1px dashed #444' }}>
          <h2 style={{ color: '#aaa' }}>No hay comandas pendientes en cocina</h2>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {comandasAgrupadas.map((grupo) => (
            <div 
              key={grupo.pedido_id} 
              style={{ 
                border: '2px solid #e67e22', 
                borderRadius: '10px', 
                padding: '16px', 
                background: '#1e1e1e',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}
            >
              <div>
                {/* Cabecera del Ticket */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#e67e22' }}>
                    {grupo.mesa}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#f39c12', fontWeight: 'bold', background: '#2c2c2c', padding: '4px 8px', borderRadius: '4px' }}>
                    🕒 {obtenerHora(grupo.hora)}
                  </span>
                </div>

                {/* Lista de Platos */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0' }}>
                  {grupo.items.map((item) => (
                    <li 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        justify: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 0', 
                        borderBottom: '1px dashed #333',
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                      }}
                    >
                      <span>
                        <span style={{ color: '#e67e22', marginRight: '8px' }}>{item.cantidad || 1}x</span>
                        {item.producto_nombre}
                      </span>
                      <button
                        onClick={() => marcarItemListo(item.id)}
                        title="Marcar plato individual"
                        style={{
                          backgroundColor: '#27ae60',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        ✔
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botón para despachar toda la mesa */}
              <button
                onClick={() => marcarComandaCompleta(grupo.items)}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                ✔ COMANDA COMPLETA LISTA
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
