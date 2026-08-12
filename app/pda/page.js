'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PdaView() {
  // Autenticación Real Supabase
  const [usuario, setUsuario] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoAuth, setCargandoAuth] = useState(false)

  // Control Fichaje
  const [fichado, setFichado] = useState(false)
  const [horaFichaje, setHoraFichaje] = useState(null)

  // Estados TPV / PDA
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  const [nombresMesas, setNombresMesas] = useState({})
  const [mesasOcupadasMap, setMesasOcupadasMap] = useState({}) // Mapeo de mesas abiertas en la BD

  const [productos, setProductos] = useState([])
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')

  // Estado del pedido de la mesa seleccionada
  const [comandaActual, setComandaActual] = useState([])
  const [pedidoIdActual, setPedidoIdActual] = useState(null)
  const [aliasActual, setAliasActual] = useState('')

  // Modales UI
  const [modalMesaAbierto, setModalMesaAbierto] = useState(false)
  const [verComandaMobile, setVerComandaMobile] = useState(false)

  // 1. Comprobar sesión activa de Supabase
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUsuario(session.user)
      }
    }
    checkSession()
  }, [])

  // 2. Cargar datos iniciales y listeners Globales
  useEffect(() => {
    cargarProductos()
    cargarNombresMesas()
    cargarMesasOcupadas()

    const channelMesas = supabase
      .channel('mesas-pda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        cargarNombresMesas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarMesasOcupadas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelMesas)
    }
  }, [])

  // 3. Sincronizar el pedido de la mesa activa en tiempo real
  useEffect(() => {
    cargarPedidoMesaActual()

    const channelPedidoActivo = supabase
      .channel('pedido-activo-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas_pedido' }, () => {
        cargarPedidoMesaActual()
        cargarMesasOcupadas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarPedidoMesaActual()
        cargarMesasOcupadas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channelPedidoActivo)
    }
  }, [zonaActiva, mesaNum])

  // Login Auténtico con Supabase Auth
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorLogin('')
    setCargandoAuth(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passInput,
      })

      if (error) {
        setErrorLogin('Credenciales inválidas. Verifica tu email y contraseña.')
      } else if (data.user) {
        setUsuario(data.user)
      }
    } catch (err) {
      setErrorLogin('Error al conectar con el servidor.')
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

  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (error || !data) return
      setProductos(data)
      const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)
      if (fams.length > 0) {
        setFamilias(fams)
        setFamiliaActiva(fams[0])
      }
    } catch (err) {
      console.error('Error cargando productos:', err)
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

  // Detecta qué mesas están abiertas en el sistema central para marcarlas en rojo
  const cargarMesasOcupadas = async () => {
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          mesa_id,
          mesas (
            zona,
            numero
          ),
          lineas_pedido (
            precio,
            cantidad
          )
        `)
        .eq('estado', 'abierto')

      if (error || !data) return

      const ocupadas = {}
      data.forEach((p) => {
        if (p.mesas) {
          const clave = `${p.mesas.zona}-${p.mesas.numero}`
          const totalMesa = p.lineas_pedido?.reduce((sum, l) => sum + Number(l.precio) * l.cantidad, 0) || 0
          ocupadas[clave] = {
            pedidoId: p.id,
            total: totalMesa,
          }
        }
      })
      setMesasOcupadasMap(ocupadas)
    } catch (e) {
      console.error('Error cargando estado de ocupación de mesas:', e)
    }
  }

  // Carga las líneas de pedido de la mesa seleccionada actualmente
  const cargarPedidoMesaActual = async () => {
    try {
      const { data: mesa } = await supabase
        .from('mesas')
        .select('id')
        .eq('zona', zonaActiva)
        .eq('numero', mesaNum)
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

      if (lineas) {
        setComandaActual(
          lineas.map((l) => ({
            id_linea: l.id,
            nombre: l.producto_nombre,
            precio: Number(l.precio),
            cantidad: l.cantidad,
            destino: l.destino,
            estado: l.estado,
          }))
        )
      }
    } catch (err) {
      console.error('Error cargando comanda de la mesa:', err)
    }
  }

  const obtenerNombreMesa = (num, zona = zonaActiva) => {
    const clave = `${zona}-${num}`
    return nombresMesas[clave] || `Mesa ${num}`
  }

  // Añadir ítem sincronizado directamente con la BD
  const agregarAlTicket = async (prod) => {
    try {
      let pId = pedidoIdActual
      let mId = null

      if (!pId) {
        const { data: mesaBD } = await supabase
          .from('mesas')
          .select('id')
          .eq('numero', mesaNum)
          .eq('zona', zonaActiva)
          .maybeSingle()

        if (mesaBD) {
          mId = mesaBD.id
        } else {
          const { data: nuevaMesa } = await supabase
            .from('mesas')
            .insert([{ numero: mesaNum, zona: zonaActiva }])
            .select()
            .single()
          if (nuevaMesa) mId = nuevaMesa.id
        }

        const { data: nuevoPedido } = await supabase
          .from('pedidos')
          .insert([{ mesa_id: mId, estado: 'abierto', nota: aliasActual }])
          .select()
          .single()

        if (nuevoPedido) {
          pId = nuevoPedido.id
          setPedidoIdActual(pId)
        }
      }

      // Si el ítem está aún en estado 'borrador', sumamos la cantidad
      const itemExistente = comandaActual.find((i) => i.nombre === prod.nombre && i.estado === 'borrador')

      if (itemExistente) {
        await supabase
          .from('lineas_pedido')
          .update({ cantidad: itemExistente.cantidad + 1 })
          .eq('id', itemExistente.id_linea)
      } else {
        await supabase.from('lineas_pedido').insert([
          {
            pedido_id: pId,
            producto_nombre: prod.nombre,
            precio: prod.precio,
            cantidad: 1,
            destino: prod.destino || 'barra', // Destino correcto (barra/cocina)
            estado: 'borrador',
          },
        ])
      }

      cargarPedidoMesaActual()
      cargarMesasOcupadas()
    } catch (err) {
      console.error('Error añadiendo ítem:', err)
    }
  }

  const cambiarCantidad = async (item, delta) => {
    const nuevaCant = item.cantidad + delta

    if (nuevaCant <= 0) {
      await supabase.from('lineas_pedido').delete().eq('id', item.id_linea)
    } else {
      await supabase.from('lineas_pedido').update({ cantidad: nuevaCant }).eq('id', item.id_linea)
    }

    cargarPedidoMesaActual()
    cargarMesasOcupadas()
  }

  // Pasa los ítems de 'borrador' a 'pendiente' para enviarlos a Cocina / Barra
  const enviarComandaBD = async () => {
    if (!pedidoIdActual || comandaActual.length === 0) return

    try {
      await supabase
        .from('lineas_pedido')
        .update({ estado: 'pendiente' })
        .eq('pedido_id', pedidoIdActual)
        .eq('estado', 'borrador')

      if (aliasActual) {
        await supabase
          .from('pedidos')
          .update({ nota: aliasActual })
          .eq('id', pedidoIdActual)
      }

      setVerComandaMobile(false)
      cargarPedidoMesaActual()
      cargarMesasOcupadas()
    } catch (err) {
      alert(`❌ Error al enviar: ${err.message}`)
    }
  }

  const calcularTotal = () => {
    return comandaActual.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)
  const opcionesMesas = Array.from({ length: 20 }, (_, i) => i + 1)

  // VISTA 1: LOGIN EMPLEADO
  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-5xl block mb-2">📱</span>
            <h1 className="text-2xl font-black text-amber-500 uppercase tracking-wider">PDA CAMARERO</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">Acceso individual con usuario y contraseña</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Email Camarero</label>
              <input
                type="email"
                required
                placeholder="camarero@bar.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {errorLogin && <p className="text-xs text-rose-500 font-bold text-center">{errorLogin}</p>}

            <button
              type="submit"
              disabled={cargandoAuth}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm uppercase rounded-xl shadow-lg active:scale-95 transition"
            >
              {cargandoAuth ? 'Ingresando...' : 'Entrar a Comandar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // VISTA 2: PRINCIPAL PDA MÓVIL
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-24">
      {/* BARRA SUPERIOR PDA */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center sticky top-0 z-30">
        <button
          onClick={() => setModalMesaAbierto(true)}
          className="bg-amber-500 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs uppercase flex items-center gap-1.5 active:scale-95 transition shadow-md"
        >
          <span>📍 {zonaActiva} - {obtenerNombreMesa(mesaNum)}</span>
          <span className="text-[10px]">▼</span>
        </button>

        <div className="flex items-center gap-2">
          {/* FICHAJE CAMARERO */}
          <button
            onClick={toggleFichaje}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition border ${
              fichado
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {fichado ? `⏰ ${horaFichaje}` : '⏹️ Fichar'}
          </button>

          {/* CERRAR SESIÓN */}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 active:scale-90"
          >
            🚪
          </button>
        </div>
      </header>

      {/* INPUT ALIAS CLIENTE */}
      <div className="bg-slate-900/40 p-2 border-b border-slate-800/80 flex items-center gap-2 px-3">
        <span className="text-xs">👤</span>
        <input
          type="text"
          placeholder="Nombre o nota (ej: Gorra roja)"
          value={aliasActual}
          onChange={(e) => setAliasActual(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* CATEGORÍAS / FAMILIAS */}
      <div className="flex gap-1.5 p-2 overflow-x-auto bg-slate-950 border-b border-slate-900 scrollbar-none">
        {familias.map((f) => (
          <button
            key={f}
            onClick={() => setFamiliaActiva(f)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase whitespace-nowrap transition ${
              familiaActiva === f
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* GRILLA DE PRODUCTOS (OPTIMIZADA PARA MÓVIL) */}
      <div className="p-2 grid grid-cols-2 gap-2 flex-1 overflow-y-auto">
        {productosFiltrados.map((p) => (
          <button
            key={p.id}
            onClick={() => agregarAlTicket(p)}
            className="bg-slate-900 border border-slate-800 active:border-amber-500 p-3 rounded-2xl flex flex-col justify-between h-24 active:scale-95 transition text-left"
          >
            <div className="flex justify-between items-start w-full">
              <span className="font-extrabold text-xs text-slate-200 line-clamp-2 leading-tight">
                {p.nombre}
              </span>
              <span className="text-lg">{p.img || '🍴'}</span>
            </div>
            <div className="flex justify-between items-end w-full border-t border-slate-800/60 pt-1">
              <span className={`text-[9px] font-black uppercase ${p.destino === 'cocina' ? 'text-rose-400' : 'text-amber-400'}`}>
                {p.destino}
              </span>
              <span className="font-black text-xs text-amber-400">{Number(p.precio).toFixed(2)}€</span>
            </div>
          </button>
        ))}
      </div>

      {/* BARRA INFERIOR FIJA - ENVIAR PEDIDO */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-2 z-20">
        <button
          onClick={() => setVerComandaMobile(true)}
          className="flex-1 bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-2xl flex justify-between items-center active:scale-98"
        >
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full">
              {comandaActual.reduce((s, i) => s + i.cantidad, 0)}
            </span>
            <span className="text-xs font-bold text-slate-300">Ver Ticket</span>
          </div>
          <span className="font-black text-amber-400 text-sm">{calcularTotal().toFixed(2)}€</span>
        </button>

        <button
          onClick={enviarComandaBD}
          disabled={comandaActual.length === 0}
          className="bg-amber-500 disabled:opacity-30 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs uppercase shadow-lg active:scale-95 transition"
        >
          🚀 ENVIAR
        </button>
      </div>

      {/* MODAL REVISIÓN TICKET DE LA MESA */}
      {verComandaMobile && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col p-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <h2 className="font-black text-amber-500 text-base uppercase">
                {zonaActiva} — {obtenerNombreMesa(mesaNum)}
              </h2>
              {aliasActual && <p className="text-xs text-amber-300 font-bold">👤 {aliasActual}</p>}
            </div>
            <button
              onClick={() => setVerComandaMobile(false)}
              className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-2">
            {comandaActual.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10">Mesa sin consumiciones añadidas.</p>
            ) : (
              comandaActual.map((item) => (
                <div
                  key={item.id_linea}
                  className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex justify-between items-center"
                >
                  <div className="max-w-[50%]">
                    <span className="font-bold text-xs text-slate-100 block truncate">{item.nombre}</span>
                    <span className="text-[10px] text-slate-400">
                      {item.precio.toFixed(2)}€/ud — <span className="uppercase text-amber-400">{item.estado}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                      <button
                        onClick={() => cambiarCantidad(item, -1)}
                        className="w-7 h-7 bg-rose-500/20 text-rose-400 font-black rounded-lg text-xs flex items-center justify-center active:scale-90"
                      >
                        -
                      </button>
                      <span className="font-black text-xs px-1.5">{item.cantidad}</span>
                      <button
                        onClick={() => cambiarCantidad(item, 1)}
                        className="w-7 h-7 bg-emerald-500/20 text-emerald-400 font-black rounded-lg text-xs flex items-center justify-center active:scale-90"
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

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-base font-black">
              <span>TOTAL ACUMULADO</span>
              <span className="text-amber-400 text-xl">{calcularTotal().toFixed(2)}€</span>
            </div>
            <button
              onClick={enviarComandaBD}
              disabled={comandaActual.length === 0}
              className="w-full py-4 bg-amber-500 disabled:opacity-30 text-slate-950 font-black text-sm uppercase rounded-2xl shadow-xl active:scale-95 transition"
            >
              🚀 ENVIAR A COCINA / BARRA
            </button>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR MESA (VISUALIZADOR MESA ROJA / VERDE) */}
      {modalMesaAbierto && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-amber-500 text-sm uppercase">Seleccionar Ubicación</h2>
              <button
                onClick={() => setModalMesaAbierto(false)}
                className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* ZONAS */}
            <div className="flex gap-2 mb-4">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => setZonaActiva(z)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition ${
                    zonaActiva === z ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            {/* GRILLA DE MESAS MOSTRANDO OCUPACIÓN REAL */}
            <div className="grid grid-cols-4 gap-2 max-h-[65vh] overflow-y-auto p-1">
              {opcionesMesas.map((n) => {
                const clave = `${zonaActiva}-${n}`
                const mesaInfo = mesasOcupadasMap[clave]
                const estaOcupada = Boolean(mesaInfo)
                const esSeleccionada = mesaNum === n
                const nombreVisual = obtenerNombreMesa(n)

                return (
                  <button
                    key={n}
                    onClick={() => {
                      setMesaNum(n)
                      setModalMesaAbierto(false)
                    }}
                    className={`p-2 rounded-2xl border text-center flex flex-col justify-between items-center h-20 transition active:scale-95 ${
                      esSeleccionada
                        ? 'ring-2 ring-amber-400 bg-amber-500 text-slate-950 font-black'
                        : estaOcupada
                        ? 'bg-rose-950/80 border-rose-600/80 text-rose-200'
                        : 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                    }`}
                  >
                    <span className="text-[11px] font-black uppercase leading-tight line-clamp-1">
                      {nombreVisual}
                    </span>

                    <span className="text-[10px] font-extrabold">
                      {estaOcupada ? `${mesaInfo.total.toFixed(2)}€` : 'Libre'}
                    </span>

                    <span
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                        estaOcupada ? 'bg-rose-600 text-white' : 'bg-emerald-600/40 text-emerald-200'
                      }`}
                    >
                      {estaOcupada ? 'Ocupada' : 'Disponible'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
