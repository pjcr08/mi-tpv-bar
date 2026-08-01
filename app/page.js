'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const PRODUCTOS_EJEMPLO = [
  // CAFÉS
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra', img: '☕' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra', img: '🥛' },
  { id: 103, nombre: 'Cortado', precio: 1.30, familia: 'Cafés', destino: 'barra', img: '☕' },
  { id: 105, nombre: 'Carajillo', precio: 2.00, familia: 'Cafés', destino: 'barra', img: '🥃' },

  // BEBIDAS
  { id: 106, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra', img: '🍺' },
  { id: 107, nombre: 'Refresco Cola', precio: 2.20, familia: 'Bebidas', destino: 'barra', img: '🥤' },
  { id: 108, nombre: 'Agua 50cl', precio: 1.50, familia: 'Bebidas', destino: 'barra', img: '💧' },
  { id: 109, nombre: 'Tercio 1/3', precio: 2.80, familia: 'Bebidas', destino: 'barra', img: '🍾' },

  // COMIDA
  { id: 111, nombre: 'Bocad. Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina', img: '🥖' },
  { id: 112, nombre: 'Ración Bravas', precio: 6.00, familia: 'Comida', destino: 'cocina', img: '🍟' },
  { id: 113, nombre: 'Tortilla', precio: 3.50, familia: 'Comida', destino: 'cocina', img: '🍳' },
  { id: 114, nombre: 'Burger Jorco', precio: 8.50, familia: 'Comida', destino: 'cocina', img: '🍔' },

  // POSTRES
  { id: 117, nombre: 'Tarta Queso', precio: 4.00, familia: 'Postres', destino: 'cocina', img: '🍰' },
  { id: 118, nombre: 'Flan Casero', precio: 3.50, familia: 'Postres', destino: 'cocina', img: '🍮' },
]

export default function PdaView() {
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  
  // Sincronización Supabase
  const [nombresMesas, setNombresMesas] = useState({})
  
  // Productos y navegación
  const [productos, setProductos] = useState([])
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')

  // Ticket por mesa
  const [comandasPorMesa, setComandasPorMesa] = useState({})
  const [aliasPorMesa, setAliasPorMesa] = useState({})

  // Modales y control de UI
  const [modalMesaAbierto, setModalMesaAbierto] = useState(false)
  const [verComandaMobile, setVerComandaMobile] = useState(false)
  const [multiplicador, setMultiplicador] = useState(1)

  const claveMesaActual = `${zonaActiva}-${mesaNum}`
  const comandaActual = comandasPorMesa[claveMesaActual] || []
  const aliasActual = aliasPorMesa[claveMesaActual] || ''

  useEffect(() => {
    cargarProductos()
    cargarNombresMesas()

    // Suscripción Realtime para actualizar mesas si cambian en el TPV
    const channel = supabase
      .channel('mesas-pda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        cargarNombresMesas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (error || !data || data.length === 0) {
        usarProductosEjemplo()
        return
      }
      setProductos(data)
      const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)
      setFamilias(fams.length > 0 ? fams : ['Cafés', 'Bebidas', 'Comida', 'Postres'])
      setFamiliaActiva(fams[0] || 'Cafés')
    } catch {
      usarProductosEjemplo()
    }
  }

  const usarProductosEjemplo = () => {
    setProductos(PRODUCTOS_EJEMPLO)
    const fams = [...new Set(PRODUCTOS_EJEMPLO.map((p) => p.familia))]
    setFamilias(fams)
    setFamiliaActiva(fams[0])
  }

  const cargarNombresMesas = async () => {
    try {
      const { data, error } = await supabase.from('mesas').select('zona, numero, nombre_custom')
      if (data && !error) {
        const mapa = {}
        data.forEach((m) => {
          if (m.nombre_custom) mapa[`${m.zona}-${m.numero}`] = m.nombre_custom
        })
        setNombresMesas(mapa)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const obtenerNombreMesa = (num, zona = zonaActiva) => {
    const clave = `${zona}-${num}`
    return nombresMesas[clave] || `Mesa ${num}`
  }

  const renombrarMesa = async (num, e) => {
    e.stopPropagation()
    const nombreActual = obtenerNombreMesa(num)
    const nuevoNombre = prompt(`Nuevo nombre para ${zonaActiva} - ${nombreActual}:`, nombreActual)

    if (nuevoNombre !== null) {
      const nombreLimpio = nuevoNombre.trim()
      const clave = `${zonaActiva}-${num}`

      setNombresMesas((prev) => ({
        ...prev,
        [clave]: nombreLimpio || `Mesa ${num}`,
      }))

      try {
        const { data: mesaExistente } = await supabase
          .from('mesas')
          .select('id')
          .eq('zona', zonaActiva)
          .eq('numero', num)
          .maybeSingle()

        if (mesaExistente) {
          await supabase.from('mesas').update({ nombre_custom: nombreLimpio }).eq('id', mesaExistente.id)
        } else {
          await supabase.from('mesas').insert([{ zona: zonaActiva, numero: num, nombre_custom: nombreLimpio }])
        }
      } catch (err) {
        console.error('Error guardando nombre:', err)
      }
    }
  }

  // Operaciones de Comanda
  const agregarAlTicket = (prod) => {
    const cant = multiplicador > 0 ? multiplicador : 1
    const actual = comandasPorMesa[claveMesaActual] || []
    const existe = actual.find((i) => i.id === prod.id)

    let nuevaComanda = []
    if (existe) {
      nuevaComanda = actual.map((i) => (i.id === prod.id ? { ...i, cantidad: i.cantidad + cant } : i))
    } else {
      nuevaComanda = [...actual, { ...prod, cantidad: cant }]
    }

    setComandasPorMesa({ ...comandasPorMesa, [claveMesaActual]: nuevaComanda })
    setMultiplicador(1)
  }

  const cambiarCantidad = (id, delta) => {
    const actual = comandasPorMesa[claveMesaActual] || []
    const nuevaComanda = actual
      .map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
      .filter((i) => i.cantidad > 0)

    setComandasPorMesa({ ...comandasPorMesa, [claveMesaActual]: nuevaComanda })
  }

  const calcularTotal = () => {
    return comandaActual.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)
  }

  const enviarComandaBD = async () => {
    if (comandaActual.length === 0) return

    try {
      let mesaId = null
      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('numero', mesaNum)
        .eq('zona', zonaActiva)
        .maybeSingle()

      if (mesaBD) {
        mesaId = mesaBD.id
      } else {
        const { data: nuevaMesa } = await supabase
          .from('mesas')
          .insert([{ numero: mesaNum, zona: zonaActiva }])
          .select()
          .single()
        if (nuevaMesa) mesaId = nuevaMesa.id
      }

      const { data: pedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'abierto', nota: aliasActual }])
        .select()
        .single()

      if (pedido) {
        const lineas = comandaActual.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'pendiente',
        }))
        await supabase.from('lineas_pedido').insert(lineas)
      }

      alert(`✅ ¡Comanda de ${zonaActiva} - ${obtenerNombreMesa(mesaNum)} enviada!`)
      setVerComandaMobile(false)
    } catch (err) {
      alert(`❌ Error al enviar: ${err.message || 'Sin respuesta'}`)
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)
  const totalItems = comandaActual.reduce((acc, item) => acc + item.cantidad, 0)

  return (
    <div className="h-screen max-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* BARRA SUPERIOR ELEGANTE Y TÁCTIL */}
      <header className="bg-slate-900 border-b border-slate-800 p-2.5 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-black text-amber-500 tracking-wider text-sm">JORCO PDA</span>
        </div>

        {/* BOTÓN MESA ACTIVA (AL PULSAR ABRE MODAL MESAS) */}
        <button
          onClick={() => setModalMesaAbierto(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-lg active:scale-95 transition"
        >
          <span>📍 {zonaActiva.toUpperCase()}</span>
          <span className="bg-slate-950/20 px-2 py-0.5 rounded-lg border border-slate-950/20">
            {obtenerNombreMesa(mesaNum)}
          </span>
          <span className="text-[10px]">▼</span>
        </button>
      </header>

      {/* INPUT RÁPIDO PARA ALIAS DEL CLIENTE */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-2.5 py-1.5 flex items-center gap-2">
        <span className="text-xs">👤</span>
        <input
          type="text"
          placeholder="Descripción del cliente (ej: Gorra roja, Barra alta...)"
          value={aliasActual}
          onChange={(e) => setAliasPorMesa({ ...aliasPorMesa, [claveMesaActual]: e.target.value })}
          className="w-full bg-transparent text-xs text-amber-200 placeholder-slate-500 font-medium focus:outline-none"
        />
        {aliasActual && (
          <button
            onClick={() => setAliasPorMesa({ ...aliasPorMesa, [claveMesaActual]: '' })}
            className="text-slate-500 text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* CARRUSEL DE FAMILIAS / CATEGORÍAS */}
      <div className="bg-slate-900 border-b border-slate-800 p-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
        {familias.map((f) => {
          const esActiva = familiaActiva === f
          return (
            <button
              key={f}
              onClick={() => setFamiliaActiva(f)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap transition-all shadow-sm active:scale-95 ${
                esActiva
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 shadow-md'
                  : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-800'
              }`}
            >
              {f}
            </button>
          )
        })}
      </div>

      {/* MULTIPLICADOR RÁPIDO (1x, 2x, 3x, 4x, 5x) */}
      <div className="bg-slate-900/40 px-2 py-1 flex items-center justify-between border-b border-slate-800/50">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cantidad a marcar:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 10].map((num) => (
            <button
              key={num}
              onClick={() => setMultiplicador(num)}
              className={`w-7 h-6 rounded-lg font-black text-xs transition active:scale-90 ${
                multiplicador === num
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border border-slate-700/40'
              }`}
            >
              {num}x
            </button>
          ))}
        </div>
      </div>

      {/* PARRILLA DE PRODUCTOS TÁCTILES */}
      <main className="flex-1 p-2 overflow-y-auto grid grid-cols-2 gap-2 align-content-start pb-24">
        {productosFiltrados.map((p) => (
          <button
            key={p.id}
            onClick={() => agregarAlTicket(p)}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 p-3 rounded-2xl flex flex-col justify-between h-24 active:scale-95 transition shadow-sm text-left group"
          >
            <div className="flex justify-between items-start w-full">
              <span className="font-bold text-xs text-slate-100 leading-snug line-clamp-2 pr-1">
                {p.nombre}
              </span>
              <span className="text-lg group-active:scale-125 transition-transform">{p.img || '🍽️'}</span>
            </div>

            <div className="flex justify-between items-end w-full border-t border-slate-800/60 pt-1.5">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                {p.destino}
              </span>
              <span className="font-black text-sm text-amber-400">
                {Number(p.precio).toFixed(2)}€
              </span>
            </div>
          </button>
        ))}
      </main>

      {/* BARRA INFERIOR FLOTANTE DE COMANDA */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-2.5 flex items-center gap-2 shadow-2xl z-30">
        
        {/* BOTÓN RESUMEN TICKET */}
        <button
          onClick={() => setVerComandaMobile(!verComandaMobile)}
          className="flex-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-2 flex items-center justify-between active:scale-95 transition"
        >
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 font-black text-xs w-6 h-6 rounded-lg flex items-center justify-center">
              {totalItems}
            </span>
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Ver Ticket</span>
              <span className="text-xs font-black text-slate-200">
                {comandaActual.length === 0 ? 'Vacío' : `${calcularTotal().toFixed(2)}€`}
              </span>
            </div>
          </div>
          <span className="text-slate-400 text-xs">{verComandaMobile ? '▼' : '▲'}</span>
        </button>

        {/* BOTÓN ENVIAR COMANDA */}
        <button
          onClick={enviarComandaBD}
          disabled={comandaActual.length === 0}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-black px-4 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center gap-1.5"
        >
          <span>🚀 ENVIAR</span>
        </button>
      </footer>

      {/* DESPLEGABLE DESDE ABAJO: DETALLE Y EDICIÓN DEL TICKET */}
      {verComandaMobile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex flex-col justify-end">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-4 max-h-[75vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-black text-amber-500 text-sm uppercase">
                  Comanda {zonaActiva} - {obtenerNombreMesa(mesaNum)}
                </h3>
                {aliasActual && <p>👤 {aliasActual}</p>}
              </div>
              <button
                onClick={() => setVerComandaMobile(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* LISTA DE ITEMS EN TICKET */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
              {comandaActual.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs italic">
                  No has añadido ningún producto a esta mesa.
                </div>
              ) : (
                comandaActual.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800/80 p-2.5 rounded-xl flex justify-between items-center"
                  >
                    <div className="flex-1 pr-2">
                      <span className="font-bold text-xs text-slate-200 block">{item.nombre}</span>
                      <span className="text-[10px] text-amber-400 font-semibold">
                        {Number(item.precio).toFixed(2)}€/unid
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cambiarCantidad(item.id, -1)}
                        className="w-7 h-7 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black rounded-lg text-sm border border-red-500/30 active:scale-90"
                      >
                        -
                      </button>
                      <span className="font-black text-sm text-slate-100 w-5 text-center">
                        {item.cantidad}
                      </span>
                      <button
                        onClick={() => cambiarCantidad(item.id, 1)}
                        className="w-7 h-7 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-black rounded-lg text-sm border border-emerald-500/30 active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TOTAL Y BOTÓN DE ENVÍO */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Comanda</span>
                <span className="text-xl font-black text-amber-400">{calcularTotal().toFixed(2)}€</span>
              </div>
              <button
                onClick={enviarComandaBD}
                disabled={comandaActual.length === 0}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition"
              >
                🚀 Confirmar y Enviar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PRO: SELECTOR Y RENOMBRADOR DE MESAS TÁCTIL */}
      {modalMesaAbierto && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 p-4 flex flex-col justify-between animate-in fade-in duration-150">
          
          <div>
            {/* CABECERA DEL MODAL */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h2 className="font-black text-amber-500 text-base uppercase tracking-wider">
                Seleccionar / Editar Mesa
              </h2>
              <button
                onClick={() => setModalMesaAbierto(false)}
                className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 font-bold text-base flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* SELECTOR DE ZONA TÁCTIL */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => setZonaActiva(z)}
                  className={`py-2.5 rounded-xl font-black text-xs uppercase transition active:scale-95 ${
                    zonaActiva === z
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            {/* PARRILLA DE MESAS (1-20) CON ACCIÓN DE SELECCIONAR Y RENOMBRAR */}
            <div className="grid grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
                const esMesaActual = mesaNum === n
                const clave = `${zonaActiva}-${n}`
                const tieneComanda = comandasPorMesa[clave] && comandasPorMesa[clave].length > 0
                const nombreVisual = obtenerNombreMesa(n)

                return (
                  <div
                    key={n}
                    onClick={() => {
                      setMesaNum(n)
                      setModalMesaAbierto(false)
                    }}
                    className={`p-2.5 rounded-2xl border flex flex-col justify-between h-20 relative active:scale-95 transition ${
                      esMesaActual
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                        : tieneComanda
                        ? 'bg-slate-900 border-emerald-500/50 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black opacity-60">#{n}</span>
                      
                      {/* BOTÓN RENOMBRAR DENTRO DE LA TARJETA */}
                      <button
                        onClick={(e) => renombrarMesa(n, e)}
                        title="Renombrar mesa"
                        className="w-5 h-5 rounded-md bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-[10px] flex items-center justify-center font-bold border border-slate-700"
                      >
                        ✏️
                      </button>
                    </div>

                    <div>
                      <span className="font-extrabold text-xs block truncate">{nombreVisual}</span>
                      {tieneComanda && (
                        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                          ● Con Pedido
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={() => setModalMesaAbierto(false)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider mt-2"
          >
            Aceptar y Cerrar
          </button>

        </div>
      )}

    </div>
  )
}
