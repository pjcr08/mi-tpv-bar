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

      // 2. Obtener los IDs de pedido únicos y consultar sus mesas con ZONA, NÚMERO y NOTA
      const pedidoIds = [...new Set(lineas.map((l) => l.pedido_id))];
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select(`
          id,
          nota,
          mesas (
            numero,
            zona
          )
        `)
        .in('id', pedidoIds);

      // 3. Crear el mapa de nombres para las mesas (incluyendo el ALIAS / NOTA si existe)
      const mapaMesas = {};
      pedidos?.forEach((p) => {
        let textoMesa = '';
        if (p.mesas) {
          const zona = p.mesas.zona ? p.mesas.zona.toUpperCase() : 'MESA';
          textoMesa = `${zona} - Mesa ${p.mesas.numero}`;
        } else {
          textoMesa = `Pedido #${p.id}`;
        }

        // Si el pedido tiene un alias/nota, se lo añadimos
        if (p.nota) {
          textoMesa += ` (${p.nota})`;
        }

        mapaMesas[p.id] = textoMesa;
      });

      // 4. Agrupar por pedido
      const grupos = {};
      lineas.forEach((linea) => {
        const pId = linea.pedido_id;
        if (!grupos[pId]) {
          grupos[pId] = {
            pedido_id: pId,
            mesa: mapaMesas[pId] || `Pedido #${pId}`,
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

  // 1. MARCAR COMANDA COMPLETA COMO LISTA
  const marcarComandaCompleta = async (pedidoId, items) => {
    // Quita la tarjeta localmente al instante
    setComandasAgrupadas((prev) => prev.filter((g) => g.pedido_id !== pedidoId));

    const ids = items.map((i) => i.id);
    const { error } = await supabase
      .from('lineas_pedido')
      .update({ estado: 'listo' })
      .in('id', ids);

    if (error) {
      console.error('Error en Supabase (revisa RLS):', error.message);
      fetchComandasCocina();
    }
  };

  // 2. BORRAR/CANCELAR COMANDA DE LA BASE DE DATOS
  const borrarComanda = async (pedidoId) => {
    if (!confirm('¿Seguro que quieres BORRAR esta comanda de cocina?')) return;

    setComandasAgrupadas((prev) => prev.filter((g) => g.pedido_id !== pedidoId));

    const { error } = await supabase
      .from('lineas_pedido')
      .delete()
      .eq('pedido_id', pedidoId)
      .eq('destino', 'cocina');

    if (error) {
      console.error('Error al borrar comanda:', error.message);
      fetchComandasCocina();
    }
  };

  // 3. MARCAR UN SOLO ÍTEM COMO LISTO
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
                  <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#e67e22' }}>
                    {grupo.mesa}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#f39c12', fontWeight: 'bold', background: '#2c2c2c', padding: '4px 8px', borderRadius: '4px' }}>
                    🕒 {obtenerHora(grupo.hora)}
                  </span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0' }}>
                  {grupo.items.map((item) => (
                    <li 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 0', 
                        borderBottom: '1px dashed #333',
                        fontSize: '1.1rem',
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

              {/* ACCIONES DE COCINA */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  onClick={() => marcarComandaCompleta(grupo.pedido_id, grupo.items)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  ✔ LISTA COMPLETA
                </button>

                <button
                  onClick={() => borrarComanda(grupo.pedido_id)}
                  title="Borrar comanda"
                  style={{
                    padding: '14px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
