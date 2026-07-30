'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase';

export default function CajaCentral() {
  const [mesasOcupadas, setMesasOcupadas] = useState([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [lineasTicket, setLineasTicket] = useState([])

  useEffect(() => {
    cargarMesasOcupadas()
  }, [])

  const cargarMesasOcupadas = async () => {
    const { data } = await supabase.from('mesas').select('*').eq('estado', 'ocupada')
    if (data) setMesasOcupadas(data)
  }

  const verDetalleMesa = async (mesa) => {
    setMesaSeleccionada(mesa)
    
    // Obtener pedido abierto
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id')
      .eq('mesa_id', mesa.id)
      .eq('estado', 'abierto')
      .single()

    if (pedido) {
      const { data: lineas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('pedido_id', pedido.id)

      if (lineas) setLineasTicket(lineas)
    }
  }

  const calcularTotal = () => lineasTicket.reduce((acc, curr) => acc + Number(curr.precio), 0)

  const cobrarEImprimir = async () => {
    if (!mesaSeleccionada) return

    // 1. Mandar a imprimir ticket
    window.print()

    // 2. Cerrar el pedido en la base de datos
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id')
      .eq('mesa_id', mesaSeleccionada.id)
      .eq('estado', 'abierto')
      .single()

    if (pedido) {
      await supabase.from('pedidos').update({ estado: 'cobrado' }).eq('id', pedido.id)
    }

    // 3. Liberar la mesa
    await supabase.from('mesas').update({ estado: 'libre' }).eq('id', mesaSeleccionada.id)

    // Resetear
    setMesaSeleccionada(null)
    setLineasTicket([])
    cargarMesasOcupadas()
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6">
      {/* Lista de mesas activas */}
      <div className="w-full md:w-1/2">
        <h2 className="text-2xl font-bold mb-4 text-amber-500">Mesas con Cuenta Pendiente</h2>
        <div className="grid grid-cols-2 gap-4">
          {mesasOcupadas.map((m) => (
            <button
              key={m.id}
              onClick={() => verDetalleMesa(m)}
              className="p-6 bg-red-950/40 border border-red-500 rounded-2xl text-left font-extrabold text-xl hover:bg-red-900/40"
            >
              Mesa {m.numero} <span className="text-xs uppercase block text-slate-400">{m.zona}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Visor e Impresión de Ticket */}
      <div className="w-full md:w-1/2 bg-slate-800 p-6 rounded-2xl flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold border-b border-slate-700 pb-2">
            {mesaSeleccionada ? `Ticket Mesa ${mesaSeleccionada.numero}` : 'Selecciona una mesa'}
          </h3>

          <div className="my-4 space-y-2">
            {lineasTicket.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.producto_nombre}</span>
                <span className="font-semibold">{item.precio}€</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="border-t border-slate-700 pt-4 flex justify-between text-2xl font-black text-amber-400 mb-4">
            <span>TOTAL:</span>
            <span>{calcularTotal().toFixed(2)}€</span>
          </div>

          <button
            onClick={cobrarEImprimir}
            disabled={!mesaSeleccionada}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xl rounded-xl uppercase transition"
          >
            💳 COBRAR E IMPRIMIR TICKET
          </button>
        </div>
      </div>
    </div>
  )
}
