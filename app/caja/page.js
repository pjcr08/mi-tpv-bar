'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function CajaCentral() {
  const [mesasOcupadas, setMesasOcupadas] = useState([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [pedidoActual, setPedidoActual] = useState(null)
  const [lineasTicket, setLineasTicket] = useState([])
  const [cargando, setCargando] = useState(false)
  const [procesandoCobro, setProcesandoCobro] = useState(false)

  // Cargar mesas ocupadas al iniciar
  useEffect(() => {
    cargarMesasOcupadas()
  }, [])

  // Obtener lista de mesas con estado 'ocupada'
  const cargarMesasOcupadas = async () => {
    const { data, error } = await supabase
      .from('mesas')
      .select('*')
      .eq('estado', 'ocupada')
      .order('numero', { ascending: true })

    if (error) {
      console.error('Error al cargar mesas:', error)
      return
    }
    setMesasOcupadas(data || [])
  }

  // Cargar el pedido abierto de la mesa seleccionada (Consulta unificada gracias a la Foreign Key)
  const verDetalleMesa = async (mesa) => {
    setMesaSeleccionada(mesa)
    setCargando(true)

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
      .maybeSingle()

    if (error) {
      console.error('Error al obtener el detalle del pedido:', error)
      setCargando(false)
      return
    }

    if (pedido) {
      setPedidoActual(pedido)
      setLineasTicket(pedido.lineas_pedido || [])
    } else {
      setPedidoActual(null)
      setLineasTicket([])
    }

    setCargando(false)
  }

  // Calcular el importe total multiplicando precio por cantidad
  const calcularTotal = () => {
    return lineasTicket.reduce((total, item) => {
      const cantidad = item.cantidad || 1
      return total + Number(item.precio) * cantidad
    }, 0)
  }

  // Proceso de impresión, marcado como cobrado y liberación de mesa
  const cobrarEImprimir = async () => {
    if (!mesaSeleccionada || !pedidoActual) return

    try {
      setProcesandoCobro(true)

      // 1. Lanzar diálogo de impresión
      window.print()

      // 2. Actualizar pedido a estado 'cobrado'
      const { error: errorPedido } = await supabase
        .from('pedidos')
        .update({ estado: 'cobrado' })
        .eq('id', pedidoActual.id)

      if (errorPedido) throw errorPedido

      // 3. Liberar la mesa
      const { error: errorMesa } = await supabase
        .from('mesas')
        .update({ estado: 'libre' })
        .eq('id', mesaSeleccionada.id)

      if (errorMesa) throw errorMesa

      // Limpiar estados y refrescar lista de mesas
      setMesaSeleccionada(null)
      setPedidoActual(null)
      setLineasTicket([])
      await cargarMesasOcupadas()
    } catch (err) {
      console.error('Error durante el proceso de cobro:', err)
      alert('Ocurrió un error al procesar el cobro. Por favor reintenta.')
    } finally {
      setProcesandoCobro(false)
    }
  }

  return (
    <>
      {/* Estilos para impresión en papel térmico */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-impresion, #ticket-impresion * {
            visibility: visible;
          }
          #ticket-impresion {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            color: #000 !important;
            background: #fff !important;
            padding: 10px;
            font-family: monospace;
          }
          .ocultar-en-impresion {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6">
        {/* Panel Izquierdo: Selección de Mesas */}
        <div className="w-full md:w-1/2 ocultar-en-impresion">
          <h2 className="text-2xl font-bold mb-4 text-amber-500">
            Mesas con Cuenta Pendiente
          </h2>

          {mesasOcupadas.length === 0 ? (
            <div className="p-8 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-400 text-center">
              No hay mesas ocupadas actualmente.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {mesasOcupadas.map((m) => {
                const esActiva = mesaSeleccionada?.id === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => verDetalleMesa(m)}
                    className={`p-6 border rounded-2xl text-left font-extrabold text-xl transition ${
                      esActiva
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-[1.02]'
                        : 'bg-red-950/40 border-red-500 hover:bg-red-900/40 text-white'
                    }`}
                  >
                    Mesa {m.numero}
                    <span
                      className={`text-xs uppercase block mt-1 ${
                        esActiva ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {m.zona || 'General'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel Derecho: Vista Previa e Impresión de Ticket */}
        <div className="w-full md:w-1/2 bg-slate-800 p-6 rounded-2xl flex flex-col justify-between border border-slate-700">
          <div id="ticket-impresion">
            <h3 className="text-xl font-bold border-b border-slate-700 pb-2 text-center md:text-left">
              {mesaSeleccionada
                ? `Ticket Mesa ${mesaSeleccionada.numero}`
                : 'Selecciona una mesa'}
            </h3>

            <div className="my-4 space-y-2">
              {cargando ? (
                <p className="text-slate-400 text-sm animate-pulse">
                  Cargando consumiciones...
                </p>
              ) : lineasTicket.length === 0 ? (
                <p className="text-slate-500 text-sm italic">
                  {mesaSeleccionada
                    ? 'No hay líneas asignadas a este pedido.'
                    : 'Haz clic en una mesa para ver su cuenta.'}
                </p>
              ) : (
                lineasTicket.map((item, idx) => {
                  const cant = item.cantidad || 1
                  const subtotal = (Number(item.precio) * cant).toFixed(2)
                  return (
                    <div
                      key={item.id || idx}
                      className="flex justify-between text-sm border-b border-slate-700/40 pb-1"
                    >
                      <span>
                        {cant > 1 && (
                          <strong className="mr-1 text-amber-400">
                            {cant}x
                          </strong>
                        )}
                        {item.producto_nombre}
                      </span>
                      <span className="font-semibold">{subtotal}€</span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-slate-700 pt-4 flex justify-between text-2xl font-black text-amber-400 mb-4">
              <span>TOTAL:</span>
              <span>{calcularTotal().toFixed(2)}€</span>
            </div>
          </div>

          <div className="ocultar-en-impresion">
            <button
              onClick={cobrarEImprimir}
              disabled={
                !mesaSeleccionada ||
                cargando ||
                procesandoCobro ||
                lineasTicket.length === 0
              }
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xl rounded-xl uppercase transition shadow-lg"
            >
              {procesandoCobro ? 'PROCESANDO...' : '💳 COBRAR E IMPRIMIR TICKET'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
