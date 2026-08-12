'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function PdaView() {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [usuario, setUsuario] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoAuth, setCargandoAuth] = useState(false)

  // --- ESTADOS DE FICHAJE ---
  const [fichado, setFichado] = useState(false)
  const [horaFichaje, setHoraFichaje] = useState(null)

  // --- ESTADOS DE UBICACIÓN Y MESAS ---
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  const [nombresMesas, setNombresMesas] = useState({})
  const [mesasOcupadasMap, setMesasOcupadasMap] = useState({})

  // --- ESTADOS DE PRODUCTOS Y CARTA ---
  const [productos, setProductos] = useState([])
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('TODOS')
  const [cargandoProductos, setCargandoProductos] = useState(true)

  // --- ESTADOS DE COMANDA ---
  const [comandaActual, setComandaActual] = useState([])
  const [pedidoIdActual, setPedidoIdActual] = useState(null)
  const [aliasActual, setAliasActual] = useState('')
  const [enviando, setEnviando] = useState(false)

  // --- ESTADOS DE MODALES ---
  const [modalMesaAbierto, setModalMesaAbierto] = useState(false)
  const [verComandaMobile, setVerComandaMobile] = useState(false)

  // 1. Verificar Sesión Inicial
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) setUsuario(session.user)
    }
    checkSession()
  }, [])

  // 2. Cargar Datos Iniciales
  useEffect(() => {
    cargarProductos()
    cargarNombresMesas()
    cargarMesasOcupadas()
  }, [])

  const cargarMesasOcupadas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          mesa_id,
          mesas ( zona, numero ),
          lineas_pedido ( precio, cantidad )
        `)
        .eq('estado', 'abierto')

      if (error || !data) return

      const ocupadas = {}
      data.forEach((p) => {
        if (p.mesas) {
          const clave = `${p.mesas.zona}-${p.mesas.numero}`
          const totalMesa = p.lineas_pedido?.reduce((sum, l) => sum + Number(l.precio) * l.cantidad, 0) || 0
          if (totalMesa > 0 && p.lineas_pedido && p.lineas_pedido.length > 0) {
            ocupadas[clave] = { pedidoId: p.id, total: totalMesa }
          }
        }
      })
      setMesasOcupadasMap(ocupadas)
    } catch (e) {
      console.error('Error leyendo ocupación:', e)
    }
  }, [])

  const cargarPedidoMesaActual = useCallback(async () => {
    try {
      const { data: mesa } = await supabase
        .from('mesas')
        .select('id')
        .eq('zona', zonaActiva)
        .eq('numero', Number(mesaNum))
        .maybeSingle()

      if (!mesa) {
        setComandaActual([])
        setPedidoIdActual(null)
        setAliasActual('')
        return
      }

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, nota')
        .eq('mesa_id', mesa.id)
        .eq('estado', 'abierto')
        .maybeSingle()

      if (!pedido) {
        setComandaActual([])
        setPedidoIdActual(null)
        setAliasActual('')
        return
      }

      setPedidoIdActual(pedido.id)
      setAliasActual(pedido.nota || '')

      const { data: lineas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('pedido_id', pedido.id)
        .order('id', { ascending: true })

      if (lineas) {
        setComandaActual(
          lineas.map((l) => ({
            id_linea: l.id,
            nombre: l.producto_nombre || l.nombre,
            precio: Number(l.precio),
            cantidad: l.cantidad,
            destino: l.destino || 'barra',
            estado: l.estado,
          }))
        )
      }
    } catch (err) {
      console.error('Error cargando comanda actual:', err)
    }
  }, [zonaActiva, mesaNum])

  // 3. Cargar Pedido al cambiar de Mesa/Zona
  useEffect(() => {
    cargarPedidoMesaActual()
  }, [cargarPedidoMesaActual])

  // 4. Suscripción en Tiempo Real Global (Sin recrear canal en cada cambio de mesa)
  useEffect(() => {
    const channelGlobal = supabase
      .channel('pda-tpv-sync-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarMesasOcupadas()
        cargarPedidoMesaActual()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarMesasOcupadas()
        cargarPedidoMesaActual()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelGlobal)
    }
  }, [cargarMesasOcupadas, cargarPedidoMesaActual])

  // LOGIN Y LOGOUT
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorLogin('')
    setCargandoAuth(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passInput,
      })

      if (error) setErrorLogin('Credenciales inválidas.')
      else if (data.user) setUsuario(data.user)
    } catch (err) {
      setErrorLogin('Error de conexión con la base de datos.')
    } finally {
      setCargandoAuth(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    setEmailInput('')
    setPassInput('')
  }

  const toggleFichaje = () => {
    const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (!fichado) {
      setFichado(true)
      setHoraFichaje(ahora)
    } else {
      setFichado(false)
      setHoraFichaje(null)
    }
  }

  // CARGA DE PRODUCTOS DE LA BASE DE DATOS
  const cargarProductos = async () => {
    setCargandoProductos(true)
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (error) throw error

      if (data && data.length > 0) {
        setProductos(data)
        const famsUnicas = Array.from(
          new Set(
            data
              .map((p) => p.familia || 'Sin Categoría')
              .map((f) => String(f).trim())
          )
        )
        setFamilias(['TODOS', ...famsUnicas])
        setFamiliaActiva('TODOS')
      } else {
        setProductos([])
        setFamilias(['TODOS'])
      }
    } catch (err) {
      console.error('Error cargando productos:', err)
    } finally {
      setCargandoProductos(false)
    }
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

  // --- AGREGAR PRODUCTO ---
  const agregarAlTicket = async (prod) => {
    if (!prod) return

    try {
      let pId = pedidoIdActual

      if (!pId) {
        let { data: mesaBD } = await supabase
          .from('mesas')
          .select('id')
          .eq('numero', Number(mesaNum))
          .eq('zona', zonaActiva)
          .maybeSingle()

        let mId = mesaBD?.id

        if (!mId) {
          const { data: nuevaMesa, error: errMesa } = await supabase
            .from('mesas')
            .insert([{ numero: Number(mesaNum), zona: zonaActiva }])
            .select('id')
            .single()

          if (errMesa) throw errMesa
          mId = nuevaMesa.id
        }

        const { data: nuevoPedido, error: errPedido } = await supabase
          .from('pedidos')
          .insert([{ mesa_id: mId, estado: 'abierto', nota: aliasActual || '' }])
          .select('id')
          .single()

        if (errPedido) throw errPedido
        pId = nuevoPedido.id
        setPedidoIdActual(pId)
      }

      const nombreProd = prod.nombre || 'Producto'
      const destinoProd = prod.destino || 'barra'
      const precioProd = Number(prod.precio || 0)

      const itemExistente = comandaActual.find(
        (i) => i.nombre === nombreProd && i.estado === 'borrador'
      )

      if (itemExistente) {
        const { error: errUpdate } = await supabase
          .from('lineas_pedido')
          .update({ cantidad: itemExistente.cantidad + 1 })
          .eq('id', itemExistente.id_linea)

        if (errUpdate) throw errUpdate
      } else {
        const { error: errInsert } = await supabase.from('lineas_pedido').insert([
          {
            pedido_id: pId,
            producto_nombre: nombreProd,
            precio: precioProd,
            cantidad: 1,
            destino: destinoProd,
            estado: 'borrador',
          },
        ])

        if (errInsert) throw errInsert
      }

      await cargarPedidoMesaActual()
      await cargarMesasOcupadas()
    } catch (err) {
      console.error('Error al agregar al ticket:', err)
      alert(`No se pudo añadir el producto: ${err.message || 'Error de base de datos'}`)
    }
  }

  const cambiarCantidad = async (item, delta) => {
    const nuevaCant = item.cantidad + delta
    if (nuevaCant <= 0) {
      await supabase.from('lineas_pedido').delete().eq('id', item.id_linea)
    } else {
      await supabase.from('lineas_pedido').update({ cantidad: nuevaCant }).eq('id', item.id_linea)
    }
    await cargarPedidoMesaActual()
    await cargarMesasOcupadas()
  }

  const guardarAliasBD = async () => {
    if (pedidoIdActual && aliasActual) {
      await supabase.from('pedidos').update({ nota: aliasActual }).eq('id', pedidoIdActual)
    }
  }

  const liberarMesa = async (pedidoId, e) => {
    if (e) e.stopPropagation()
    if (!pedidoId) return
    if (!confirm('¿Liberar esta mesa y cancelar su pedido actual?')) return

    try {
      await supabase.from('lineas_pedido').delete().eq('pedido_id', pedidoId)
      await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', pedidoId)
      await cargarMesasOcupadas()
      await cargarPedidoMesaActual()
    } catch (err) {
      console.error('Error liberando mesa:', err)
    }
  }

  // --- ENVIAR COMANDA A COCINA Y BARRA ---
  const enviarComandaBD = async () => {
    if (!pedidoIdActual) return

    const borradores = comandaActual.filter((i) => i.estado === 'borrador')
    if (borradores.length === 0) return

    setEnviando(true)

    try {
      const { error } = await supabase
        .from('lineas_pedido')
        .update({ estado: 'pendiente' })
        .eq('pedido_id', pedidoIdActual)
        .eq('estado', 'borrador')

      if (error) throw error

      if (aliasActual) {
        await supabase
          .from('pedidos')
          .update({ nota: aliasActual })
          .eq('id', pedidoIdActual)
      }

      await cargarPedidoMesaActual()
      setVerComandaMobile(false)
    } catch (err) {
      alert(`❌ Error al enviar comanda: ${err.message}`)
    } finally {
      setEnviando(false)
    }
  }

  const calcularTotal = () => comandaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const tieneBorradores = comandaActual.some((i) => i.estado === 'borrador')

  const productosFiltrados = productos.filter((p) => {
    if (familiaActiva === 'TODOS') return true
    const famProd = (p.familia || 'Sin Categoría').toString().trim().toUpperCase()
    return famProd === familiaActiva.toUpperCase()
  })

  const opcionesMesas = Array.from({ length: 20 }, (_, i) => i + 1)

  // --- VISTA FORMULARIO LOGIN ---
  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xs bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl block mb-2">📲</span>
            <h1 className="text-xl font-black text-amber-500 uppercase tracking-wider">PDA CAMARERO</h1>
            <p className="text-xs text-slate-400 mt-1">Inicia sesión para comendar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="camarero@bar.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {errorLogin && <p className="text-xs text-rose-500 font-bold text-center">{errorLogin}</p>}

            <button
              type="submit"
              disabled={cargandoAuth}
              className="w-full py-3 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg active:scale-95 transition cursor-pointer"
            >
              {cargandoAuth ? 'Ingresando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- VISTA PRINCIPAL PDA ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start select-none">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-950 border-x border-slate-800/50 relative pb-20">
        
        {/* HEADER */}
        <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-2.5 flex justify-between items-center sticky top-0 z-20">
          <button
            type="button"
            onClick={() => setModalMesaAbierto(true)}
            className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
          >
            <span>📍 {zonaActiva} - {obtenerNombreMesa(mesaNum)}</span>
            <span className="text-[10px]">▼</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFichaje}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition border ${
                fichado
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {fichado ? `⏰ ${horaFichaje}` : '⏹ Fichar'}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 bg-slate-800 text-slate-400 rounded-xl border border-slate-700 active:scale-90 cursor-pointer"
            >
              🚪
            </button>
          </div>
        </header>

        {/* ALIAS DE MESA / NOTA */}
        <div className="p-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-2 px-3">
          <span className="text-xs">👤</span>
          <input
            type="text"
            placeholder="Nombre o nota (ej: Gorra roja)"
            value={aliasActual}
            onChange={(e) => setAliasActual(e.target.value)}
            onBlur={guardarAliasBD}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* SELECTOR DE FAMILIAS */}
        <div className="flex gap-2 p-2 overflow-x-auto bg-slate-950 border-b border-slate-800/80 no-scrollbar">
          {familias.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamiliaActiva(f)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase whitespace-nowrap transition cursor-pointer ${
                familiaActiva === f
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* REJILLA DE PRODUCTOS CON OPTIMIZACIÓN TÁCTIL */}
        <div className="p-2.5 flex-1 overflow-y-auto">
          {cargandoProductos ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
              <span className="text-2xl mb-2 animate-spin">⏳</span>
              Cargando carta de productos...
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs text-center px-4">
              <span className="text-2xl mb-2">🍽️</span>
              No hay productos disponibles en esta categoría.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {productosFiltrados.map((p) => {
                const nombreProd = p.nombre || 'Sin nombre'
                const precioProd = Number(p.precio || 0).toFixed(2)

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarAlTicket(p)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 active:border-amber-500 p-3 rounded-2xl flex flex-col justify-between h-24 text-left active:scale-95 transition cursor-pointer select-none touch-manipulation"
                  >
                    <div className="flex justify-between items-start w-full pointer-events-none">
                      <span className="font-bold text-xs text-slate-100 line-clamp-2 leading-tight">
                        {nombreProd}
                      </span>
                      <span className="text-base leading-none">{p.img || '🍴'}</span>
                    </div>
                    <div className="flex justify-between items-end w-full border-t border-slate-800/80 pt-1.5 pointer-events-none">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${p.destino === 'cocina' ? 'text-rose-400' : 'text-amber-400'}`}>
                        {p.destino || 'barra'}
                      </span>
                      <span className="font-black text-xs text-amber-400">{precioProd}€</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* BARRA INFERIOR FIJA */}
        <div className="fixed bottom-0 max-w-md w-full p-2.5 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center gap-2 z-30">
          <button
            type="button"
            onClick={() => setVerComandaMobile(true)}
            className="flex-1 bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-2xl flex justify-between items-center active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full">
                {comandaActual.reduce((s, i) => s + i.cantidad, 0)}
              </span>
              <span className="text-xs font-bold text-slate-300">Ver Ticket</span>
            </div>
            <span className="font-black text-amber-400 text-xs">{calcularTotal().toFixed(2)}€</span>
          </button>

          <button
            type="button"
            onClick={enviarComandaBD}
            disabled={!tieneBorradores || enviando}
            className="bg-amber-500 disabled:opacity-30 text-slate-950 font-black px-4 py-3 rounded-2xl text-xs uppercase shadow-lg active:scale-95 transition cursor-pointer"
          >
            {enviando ? '⏳...' : '🚀 ENVIAR'}
          </button>
        </div>

        {/* MODAL DETALLE DE COMANDA */}
        {verComandaMobile && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h2 className="font-black text-amber-500 text-sm uppercase">
                  {zonaActiva} — {obtenerNombreMesa(mesaNum)}
                </h2>
                {aliasActual && <p className="text-xs text-amber-300 font-bold">👤 {aliasActual}</p>}
              </div>
              <button
                type="button"
                onClick={() => setVerComandaMobile(false)}
                className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full flex items-center justify-center active:scale-90 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {comandaActual.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-10">Mesa sin consumiciones añadidas.</p>
              ) : (
                comandaActual.map((item) => (
                  <div
                    key={item.id_linea}
                    className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex justify-between items-center"
                  >
                    <div className="max-w-[45%]">
                      <span className="font-bold text-xs text-slate-100 block truncate">{item.nombre}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        {item.precio.toFixed(2)}€/ud — 
                        <span className={`uppercase font-bold ${item.estado === 'borrador' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {item.estado === 'borrador' ? 'Sin Enviar' : 'Enviado'}
                        </span>
                        <span className={`text-[8px] px-1 rounded uppercase ${item.destino === 'cocina' ? 'bg-rose-900/50 text-rose-300' : 'bg-blue-900/50 text-blue-300'}`}>
                          {item.destino}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item, -1)}
                          className="w-6 h-6 bg-rose-500/20 text-rose-400 font-black rounded-lg text-xs flex items-center justify-center active:scale-90 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-black text-xs px-1">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(item, 1)}
                          className="w-6 h-6 bg-emerald-500/20 text-emerald-400 font-black rounded-lg text-xs flex items-center justify-center active:scale-90 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-black text-xs text-amber-400 w-12 text-right">
                        {(item.precio * item.cantidad).toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-sm font-black">
                <span>TOTAL ACUMULADO</span>
                <span className="text-amber-400 text-lg">{calcularTotal().toFixed(2)}€</span>
              </div>
              
              <div className="flex gap-2">
                {pedidoIdActual && (
                  <button
                    type="button"
                    onClick={(e) => {
                      liberarMesa(pedidoIdActual, e)
                      setVerComandaMobile(false)
                    }}
                    className="py-3.5 px-4 bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold text-xs uppercase rounded-2xl active:scale-95 transition cursor-pointer"
                  >
                    🗑️ Vaciar
                  </button>
                )}
                <button
                  type="button"
                  onClick={enviarComandaBD}
                  disabled={!tieneBorradores || enviando}
                  className="flex-1 py-3.5 bg-amber-500 disabled:opacity-30 text-slate-950 font-black text-xs uppercase rounded-2xl shadow-xl active:scale-95 transition cursor-pointer"
                >
                  {enviando ? 'ENVIANDO...' : '🚀 ENVIAR A COCINA / BARRA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SELECTOR DE MESA */}
        {modalMesaAbierto && (
          <div className="fixed inset-0 bg-slate-950/95 z-50 p-4 flex flex-col justify-between max-w-md mx-auto">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-black text-amber-500 text-xs uppercase">Seleccionar Ubicación</h2>
                <button
                  type="button"
                  onClick={() => setModalMesaAbierto(false)}
                  className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full flex items-center justify-center active:scale-90 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* ZONAS */}
              <div className="flex gap-1.5 mb-4">
                {['Terraza', 'Salón', 'Barra'].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZonaActiva(z)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition cursor-pointer ${
                      zonaActiva === z ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>

              {/* REJILLA MESAS */}
              <div className="grid grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto p-1">
                {opcionesMesas.map((n) => {
                  const clave = `${zonaActiva}-${n}`
                  const mesaInfo = mesasOcupadasMap[clave]
                  const estaOcupada = Boolean(mesaInfo)
                  const esSeleccionada = mesaNum === n
                  const nombreVisual = obtenerNombreMesa(n)

                  return (
                    <div
                      key={n}
                      onClick={() => {
                        setMesaNum(n)
                        setModalMesaAbierto(false)
                      }}
                      className={`p-2 rounded-2xl border text-center flex flex-col justify-between items-center h-20 transition active:scale-95 cursor-pointer relative ${
                        esSeleccionada
                          ? 'ring-2 ring-amber-400 bg-amber-500 text-slate-950 font-black'
                          : estaOcupada
                          ? 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                          : 'bg-emerald-950/30 border-emerald-600/40 text-emerald-300'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase leading-tight line-clamp-1">
                        {nombreVisual}
                      </span>

                      <span className="text-[11px] font-black">
                        {estaOcupada ? `${mesaInfo.total.toFixed(2)}€` : 'Libre'}
                      </span>

                      <div className="flex items-center gap-1 w-full justify-center">
                        <span
                          className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                            estaOcupada ? 'bg-rose-600 text-white' : 'bg-emerald-600/40 text-emerald-200'
                          }`}
                        >
                          {estaOcupada ? 'Ocupada' : 'Disponible'}
                        </span>
                        {estaOcupada && (
                          <button
                            type="button"
                            title="Liberar Mesa"
                            onClick={(e) => liberarMesa(mesaInfo.pedidoId, e)}
                            className="bg-rose-900/80 hover:bg-rose-700 text-white text-[9px] p-0.5 px-1 rounded border border-rose-500/50 cursor-pointer"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
