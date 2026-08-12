'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function ComandasBarra() {
  const [comandas, setComandas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorBD, setErrorBD] = useState(null)

  const cargarComandas = useCallback(async () => {
    try {
      setErrorBD(null)

      // Consultar pedidos abiertos especificando la relación Foreign Key exacta
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          nota,
          created_at,
          mesas ( zona, numero, nombre_custom ),
          lineas_pedido!lineas_pedido_pedido_id_fkey ( id, producto_nombre, cantidad, destino, estado )
        `)
        .eq('estado', 'abierto')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error Supabase al cargar comandas:', error)
        setErrorBD(error.message)
        return
      }

      if (!data) {
        setComandas([])
        return
      }

      // Filtrar y mapear únicamente productos de BARRA pendientes
      const comandasProcesadas = data
        .map((pedido) => {
          const lineasBarra = (pedido.lineas_pedido || []).filter((l) => {
            const esBarra = String(l.destino || '').toLowerCase() === 'barra'
            const esPendiente = String(l.estado || '').toLowerCase() === 'pendiente'
            return esBarra && esPendiente
          })

          if (lineasBarra.length === 0) return null

          // Formato de nombre de mesa
          const zona = pedido.mesas?.zona || 'Sin Zona'
          const num = pedido.mesas?.numero || ''
          const custom = pedido.mesas?.nombre_custom
          const nombreMesa = custom ? custom : `Mesa ${num}`

          // Formato de hora (HH:MM)
          const hora = pedido.created_at
            ? new Date(pedido.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '--:--'

          return {
            pedidoId: pedido.id,
            zona,
            mesa: nombreMesa,
            alias: pedido.nota || '',
            hora,
            lineas: lineasBarra,
          }
        })
        .filter(Boolean)

      setComandas(comandasProcesadas)
    } catch (err) {
      console.error('Error de red/servidor:', err)
      setErrorBD(err.message || 'Error desconocido al conectar con la base de datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarComandas()

    // Suscripción Realtime optimizada
    const channel = supabase
      .channel('comandas-barra-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarComandas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarComandas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cargarComandas])

  const marcarLineaServida = async (lineaId) => {
    try {
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'servido' })
        .eq('id', lineaId)

      if (error) {
        alert(`Error al cambiar estado: ${error.message}`)
        return
      }

      await cargarComandas()
    } catch (err) {
      console.error('Error al marcar linea servida:', err)
    }
  }

  const servirTodoElPedido = async (lineas) => {
    try {
      const ids = lineas.map((l) => l.id)
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'servido' })
        .in('id', ids)

      if (error) {
        alert(`Error al servir comandas: ${error.message}`)
        return
      }

      await cargarComandas()
    } catch (err) {
      console.error('Error al servir todo el pedido:', err)
    }
  }

  const borrarPedidoComanda = async (pedidoId) => {
    if (!confirm('¿Seguro que deseas anular estas bebidas?')) return

    try {
      const comandaActual = comandas.find((c) => c.pedidoId === pedidoId)
      if (!comandaActual) return

      const ids = comandaActual.lineas.map((l) => l.id)
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'cancelado' })
        .in('id', ids)

      if (error) {
        alert(`Error al anular comanda: ${error.message}`)
        return
      }

      await cargarComandas()
    } catch (err) {
      console.error('Error al borrar comanda:', err)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans select-none">
      {/* ENCABEZADO */}
      <header className="mb-6 flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍹</span>
          <div>
            <h1 className="text-2xl font-black tracking-wider text-cyan-400 uppercase">
              COMANDAS DE BARRA
            </h1>
            <p className="text-xs text-slate-400 font-semibold">
              Bebidas y tragos pendientes en tiempo real
            </p>
          </div>
        </div>

        <button
          onClick={cargarComandas}
          className="bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition active:scale-95"
        >
          🔄 Refrescar
        </button>
      </header>

      {/* MENSAJE DE ERROR BD SI EXISTE */}
      {errorBD && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-mono">
          🚨 <strong>Error de lectura Supabase:</strong> {errorBD}
        </div>
      )}

      {/* ESTADO CARGANDO */}
      {cargando ? (
        <div className="flex justify-center py-24 text-slate-500 text-sm font-bold">
          Cargando comandas de barra...
        </div>
      ) : comandas.length === 0 ? (
        /* ESTADO VACÍO */
        <div className="flex flex-col items-center justify-center py-24 text-slate-600">
          <span className="text-5xl mb-2">✨</span>
          <p className="text-sm font-bold uppercase tracking-widest">
            Sin comandas pendientes en barra
          </p>
        </div>
      ) : (
        /* GRID DE COMANDAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {comandas.map((cmd) => (
            <div
              key={cmd.pedidoId}
              className="bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-4 shadow-xl flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                  <div>
                    <h2 className="text-base font-black text-cyan-400 uppercase tracking-wide">
                      {cmd.zona} - {cmd.mesa}
                    </h2>
                    {cmd.alias && (
                      <span className="inline-block mt-1 bg-cyan-500/10 text-cyan-300 font-extrabold text-xs px-2 py-0.5 rounded-md border border-cyan-500/30">
                        👤 {cmd.alias}
                      </span>
                    )}
                  </div>

                  <span className="bg-slate-950 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md border border-slate-800 flex items-center gap-1">
                    ⏰ {cmd.hora}
                  </span>
                </div>

                <div className="space-y-2 mt-3">
                  {cmd.lineas.map((linea) => (
                    <div
                      key={linea.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center"
                    >
                      <span className="font-extrabold text-sm text-slate-100">
                        <strong className="text-cyan-400 font-black mr-1.5">
                          {linea.cantidad}x
                        </strong>
                        {linea.producto_nombre}
                      </span>

                      <button
                        onClick={() => marcarLineaServida(linea.id)}
                        className="w-8 h-8 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/30 flex items-center justify-center font-black transition active:scale-95"
                        title="Marcar como servido"
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => servirTodoElPedido(cmd.lineas)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10"
                >
                  ✓ SERVIR TODO
                </button>

                <button
                  onClick={() => borrarPedidoComanda(cmd.pedidoId)}
                  className="bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 p-2.5 rounded-xl transition active:scale-95 flex items-center justify-center"
                  title="Anular comanda"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
