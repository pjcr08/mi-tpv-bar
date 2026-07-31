'use client';
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function HomePrincipal() {
  const [mesasOcupadas, setMesasOcupadas] = useState([])
  const [zonaFiltro, setZonaFiltro] = useState('Todas')
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [pedidoActual, setPedidoActual] = useState(null)
  const [lineasTicket, setLineasTicket] = useState([])
  const [cargando, setCargando] = useState(false)
  const [procesandoCobro, setProcesandoCobro] = useState(false)

  useEffect(() => {
    cargarMesasOcupadas()

    const channel = supabase
      .channel('cambios-caja-principal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        cargarMesasOcupadas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const cargarMesasOcupadas = async () => {
    const { data, error } = await supabase
      .from('mesas')
      .select('*')
      .eq('estado', 'ocupada')
      .order('numero', { ascending: true })

    if (error) {
      console.error('Error al obtener mesas:', error)
      return
    }
    setMesasOcupadas(data || [])
  }

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
      console.error('Error al cargar pedido:', error)
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

  const calcularTotal = () => {
    return lineasTicket.reduce((total, item) => {
      const cantidad = item.cantidad || 1
      return total + Number(item.precio) * cantidad
    }, 0)
  }

  const cobrarEImprimir = async () => {
    if (!mesaSeleccionada || !pedidoActual) return

    try {
      setProcesandoCobro(true)

      window.print()

      const { error: errorPedido } = await supabase
        .from('pedidos')
        .update({ estado: 'cobrado' })
        .eq('id', pedidoActual.id)

      if (errorPedido) throw errorPedido

      const { error: errorMesa } = await supabase
        .from('mesas')
        .update({ estado: 'libre' })
        .eq('id', mesaSeleccionada.id)

      if (errorMesa) throw errorMesa

      setMesaSeleccionada(null)
      setPedidoActual(null)
      setLineasTicket([])
      await cargarMesasOcupadas()
    } catch (err) {
      console.error('Error procesando el cobro:', err)
      alert('Hubo un error al procesar el cobro. Reinténtalo.')
    } finally {
      setProcesandoCobro(false)
    }
  }

  // Filtrar mesas ocupadas según la pestaña activa
  const mesasFiltradas = zonaFiltro === 'Todas' 
    ? mesasOcupadas 
    : mesasOcupadas.filter((m) => m.zona === zonaFiltro)

  return (
    <>
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
          .no-imprimir {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6">
        {/* PANEL IZQUIERDO: Mesas Ocupadas (Filtrables por Zona) */}
        <div className="w-full md:w-1/2 no-imprimir">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-amber-500">
              Cuentas Pendientes ({mesasOcupadas.length})
            </h2>
          </div>

          {/* Filtros por Zona */}
          <div className="flex gap-2 mb-4">
            {['Todas', 'Terraza', 'Salón', 'Barra'].map((z) => (
              <button
                key={z}
                onClick={() => setZonaFiltro(z)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                  zonaFiltro === z
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {z}
              </button>
            ))}
          </div>

          {mesasFiltradas.length === 0 ? (
            <div className="p-8 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-slate-400 text-center font-medium">
              No hay mesas ocupadas en {zonaFiltro === 'Todas' ? 'ninguna zona' : `la zona ${zonaFiltro}`}.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[75vh] overflow-y-auto pr-1">
              {mesasFiltradas.map((m) => {
                const esActiva = mesaSeleccionada?.id === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => verDetalleMesa(m)}
                    className={`p-4 border rounded-2xl text-left transition ${
                      esActiva
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-[1.02]'
                        : 'bg-red-950/40 border-red-500/80 hover:bg-red-900/40 text-white'
                    }`}
                  >
                    <span className="font-black text-lg block">Mesa {m.numero}</span>
                    <span
                      className={`text-[10px] uppercase font-bold block mt-1 ${
                        esActiva ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {m.zona}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* PANEL DERECHO: Visor de Ticket */}
        <div className="w-full md:w-1/2 bg-slate-800 p-6 rounded-2xl flex flex-col justify-between border border-slate-700/80 shadow-2xl">
          <div id="ticket-impresion">
            <h3 className="text-xl font-bold border-b border-slate-700 pb-3 text-center md:text-left">
              {mesaSeleccionada
                ? `Ticket Mesa ${mesaSeleccionada.numero} (${mesaSeleccionada.zona})`
                : 'Selecciona una mesa'}
            </h3>

            <div className="my-4 space-y-2">
              {cargando ? (
                <p className="text-slate-400 text-sm animate-pulse py-2">
                  Cargando comandas...
                </p>
              ) : lineasTicket.length === 0 ? (
                <p className="text-slate-500 text-sm italic py-2">
                  {mesaSeleccionada
                    ? 'No hay consumiciones en este pedido.'
                    : 'Haz clic en una mesa para cargar la cuenta.'}
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

          <div className="no-imprimir">
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
