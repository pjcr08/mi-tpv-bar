'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function BarraPage() {
  const [comandasAgrupadas, setComandasAgrupadas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const fetchComandasBarra = async () => {
    try {
      const { data: lineas, error: errLineas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('destino', 'barra')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true });

      if (errLineas) {
        console.error('Error lineas:', errLineas.message);
        return;
      }

      if (!lineas || lineas.length === 0) {
        setComandasAgrupadas([]);
        return;
      }

      const pedidoIds = [...new Set(lineas.map((l) => l.pedido_id))];
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, mesa_id')
        .in('id', pedidoIds);

      const mapaMesas = {};
      pedidos?.forEach((p) => {
        mapaMesas[p.id] = p.mesa_id;
      });

      const grupos = {};
      lineas.forEach((linea) => {
        const pId = linea.pedido_id;
        if (!grupos[pId]) {
          grupos[pId] = {
            pedido_id: pId,
            mesa: mapaMesas[pId] ? `Mesa ${mapaMesas[pId]}` : `Pedido #${pId}`,
            hora: linea.created_at,
            items: []
          };
        }
        grupos[pId].items.push(linea);
      });

      setComandasAgrupadas(Object.values(grupos));
    } catch (err) {
      console.error('Error general:', err);
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
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          fetchComandasBarra();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // SOLUCIÓN: Marcar todas las líneas del pedido de golpe por pedido_id y destino
  const marcarComandaCompleta = async (pedidoId) => {
    try {
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'servido' })
        .eq('pedido_id', pedidoId)
        .eq('destino', 'barra');

      if (error) {
        console.error('Error actualizando comanda completa:', error.message);
      } else {
        // Actualizamos estado local inmediatamente para respuesta instantánea
        setComandasAgrupadas((prev) => prev.filter((g) => g.pedido_id !== pedidoId));
      }
    } catch (err) {
      console.error('Error en marcarComandaCompleta:', err);
    }
  };

  const marcarItemListo = async (id) => {
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'servido' })
      .eq('id', id);

    if (!error) {
      fetchComandasBarra();
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
        <h1 style={{ color: '#3498db', margin: 0, fontSize: '2rem' }}>🍹 COMANDAS DE BARRA</h1>
        <button 
          onClick={fetchComandasBarra}
          style={{ padding: '10px 18px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🔄 Recargar
        </button>
      </div>

      {cargando ? (
        <p>Cargando comandas...</p>
      ) : comandasAgrupadas.length === 0 ? (
        <div style={{ padding: '50px', textAlign: 'center', background: '#1e1e1e', borderRadius: '8px', border: '1px dashed #444' }}>
          <h2 style={{ color: '#aaa' }}>No hay bebidas pendientes en barra</h2>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {comandasAgrupadas.map((grupo) => (
            <div 
              key={grupo.pedido_id} 
              style={{ 
                border: '2px solid #3498db', 
                borderRadius: '10px', 
                padding: '16px', 
                background: '#1e1e1e',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#3498db' }}>
                    {grupo.mesa}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#3498db', fontWeight: 'bold', background: '#2c2c2c', padding: '4px 8px', borderRadius: '4px' }}>
                    🕒 {obtenerHora(grupo.hora)}
                  </span>
                </div>

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
                        <span style={{ color: '#3498db', marginRight: '8px' }}>{item.cantidad || 1}x</span>
                        {item.producto_nombre}
                      </span>
                      <button
                        onClick={() => marcarItemListo(item.id)}
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

              <button
                onClick={() => marcarComandaCompleta(grupo.pedido_id)}
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
                ✔ SERVIR COMANDA COMPLETA
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
