'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CocinaPage() {
  const [comandasAgrupadas, setComandasAgrupadas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const fetchComandasCocina = async () => {
    try {
      // 1. Obtener todas las líneas pendientes de cocina
      const { data: lineas, error: errLineas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('destino', 'cocina')
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

      // 2. Obtener los IDs de pedido únicos y consultar sus mesas
      const pedidoIds = [...new Set(lineas.map((l) => l.pedido_id))];
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, mesa_id')
        .in('id', pedidoIds);

      const mapaMesas = {};
      pedidos?.forEach((p) => {
        mapaMesas[p.id] = p.mesa_id;
      });

      // 3. Agrupar manualmente por pedido
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
    fetchComandasCocina();

    const channel = supabase
      .channel('realtime_cocina')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineas_pedido' },
        () => {
          fetchComandasCocina();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const marcarComandaCompleta = async (items) => {
    const ids = items.map((i) => i.id);
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'listo' })
      .in('id', ids);

    if (!error) {
      fetchComandasCocina();
    }
  };

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#e67e22' }}>
                    {grupo.mesa}
                  </span>
                  <span style={{ fontSize: '1rem', color: '#f39c12', fontWeight: 'bold', background: '#2c2c2c', padding: '4px 8px', borderRadius: '4px' }}>
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
                        <span style={{ color: '#e67e22', marginRight: '8px' }}>{item.cantidad || 1}x</span>
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
