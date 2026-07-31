'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CajaCentral() {
  const [mesasOcupadas, setMesasOcupadas] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [pedidoActual, setPedidoActual] = useState(null);
  const [lineasTicket, setLineasTicket] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    cargarMesasOcupadas();
  }, []);

  const cargarMesasOcupadas = async () => {
    const { data, error } = await supabase
      .from('mesas')
      .select('*')
      .eq('estado', 'ocupada');

    if (error) console.error('Error al cargar mesas:', error);
    if (data) setMesasOcupadas(data);
  };

  const verDetalleMesa = async (mesa) => {
    setMesaSeleccionada(mesa);
    setCargando(true);

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        lineas_pedido (
          id,
          producto_nombre,
          precio,
          cantidad
        )
      `)
      .eq('mesa_id', mesa.id)
      .eq('estado', 'abierto')
      .maybeSingle();

    if (error) {
      console.error('Error al obtener el pedido:', error);
      setCargando(false);
      return;
    }

    if (pedido) {
      setPedidoActual(pedido);
      setLineasTicket(pedido.lineas_pedido || []);
    } else {
      setPedidoActual(null);
      setLineasTicket([]);
    }

    setCargando(false);
  };

  const calcularTotal = () => {
    return lineasTicket.reduce((acc, curr) => {
      const cantidad = curr.cantidad || 1;
      return acc + Number(curr.precio) * cantidad;
    }, 0);
  };

  const cobrarEImprimir = async () => {
    if (!mesaSeleccionada || !pedidoActual) return;

    try {
      setCargando(true);

      // 1. Mandar a imprimir
      window.print();

      // 2. Marcar pedido como 'cobrado'
      const { error: errorPedido } = await supabase
        .from('pedidos')
        .update({ estado: 'cobrado' })
        .eq('id', pedidoActual.id);

      if (errorPedido) throw errorPedido;

      // 3. Liberar la mesa
      const { error: errorMesa } = await supabase
        .from('mesas')
        .update({ estado: 'libre' })
        .eq('id', mesaSeleccionada.id);

      if (errorMesa) throw errorMesa;

      // Limpiar estados y recargar
      setMesaSeleccionada(null);
      setPedidoActual(null);
      setLineasTicket([]);
      await cargarMesasOcupadas();
    } catch (err) {
      console.error('Error durante el proceso de cobro:', err);
      alert('Hubo un problema al procesar el cobro');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {/* CSS estándar para impresión en impresoras térmicas */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-print, #ticket-print * {
            visibility: visible;
          }
          #ticket-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            color: black !important;
            background: white !important;
            padding: 10px;
            font-family: monospace;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6">
        {/* Panel izquierdo: Selección de mesas */}
        <div className="w-full md:w-1/2 no-print">
          <h2 className="text-2xl font-bold mb-4 text-amber-500">
            Mesas con Cuenta Pendiente
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {mesasOcupadas.map((m) => {
              const esSeleccionada = mesaSeleccionada?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => verDetalleMesa(m)}
                  className={`p-6 border rounded-2xl text-left font-extrabold text-xl transition ${
                    esSeleccionada
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-red-950/40 border-red-500 hover:bg-red-900/40 text-white'
                  }`}
                >
                  Mesa {m.numero}
                  <span className={`text-xs uppercase block ${esSeleccionada ? 'text-slate-800' : 'text-slate-400'}`}>
                    {m.zona}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel derecho / Ticket visual */}
        <div className="w-full md:w-1/2 bg-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div id="ticket-print">
            <h3 className="text-xl font-bold border-b border-slate-700 pb-2 text-center md:text-left">
              {mesaSeleccionada
                ? `Ticket Mesa ${mesaSeleccionada.numero}`
                : 'Selecciona una mesa'}
            </h3>

            <div className="my-4 space-y-2">
              {cargando ? (
                <p className="text-slate-400 text-sm">Cargando datos...</p>
              ) : (
                lineasTicket.map((item, idx) => {
                  const cant = item.cantidad || 1;
                  const subtotal = (Number(item.precio) * cant).toFixed(2);
                  return (
                    <div key={idx} className="flex justify-between text-sm border-b border-slate-700/50 pb-1">
                      <span>
                        {cant > 1 && <strong className="mr-1">{cant}x</strong>}
                        {item.producto_nombre}
                      </span>
                      <span className="font-semibold">{subtotal}€</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-700 pt-4 flex justify-between text-2xl font-black text-amber-400 mb-4">
              <span>TOTAL:</span>
              <span>{calcularTotal().toFixed(2)}€</span>
            </div>
          </div>

          {/* Botón de acción */}
          <div className="no-print">
            <button
              onClick={cobrarEImprimir}
              disabled={!mesaSeleccionada || cargando || lineasTicket.length === 0}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xl rounded-xl uppercase transition"
            >
              💳 COBRAR E IMPRIMIR TICKET
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
