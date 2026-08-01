'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PdaView() {
  // Autenticación
  const [usuario, setUsuario] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [errorLogin, setErrorLogin] = useState('')

  // Control Fichaje
  const [fichado, setFichado] = useState(false)
  const [horaFichaje, setHoraFichaje] = useState(null)

  // Modales adicionales
  const [modalStockAbierto, setModalStockAbierto] = useState(false)
  const [modalTurnosAbierto, setModalTurnosAbierto] = useState(false)
  const [faltaTextoManual, setFaltaTextoManual] = useState('')
  const [listaFaltas, setListaFaltas] = useState([])

  // Turnos de trabajo
  const [turnos, setTurnos] = useState({
    'Viernes Noche': [],
    'Sábado Mañana': [],
    'Sábado Noche': [],
    'Domingo Mañana': [],
    'Domingo Noche': [],
    'Festivo': [],
  })

  // Estados TPV / PDA
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  const [nombresMesas, setNombresMesas] = useState({})
  const [productos, setProductos] = useState([])
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [comandasPorMesa, setComandasPorMesa] = useState({})
  const [aliasPorMesa, setAliasPorMesa] = useState({})
  const [modalMesaAbierto, setModalMesaAbierto] = useState(false)
  const [verComandaMobile, setVerComandaMobile] = useState(false)

  const claveMesaActual = `${zonaActiva}-${mesaNum}`
  const comandaActual = comandasPorMesa[claveMesaActual] || []
  const aliasActual = aliasPorMesa[claveMesaActual] || ''

  useEffect(() => {
    cargarProductos()
    cargarNombresMesas()

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

  const handleLogin = (e) => {
    e.preventDefault()
    if (!emailInput || !passInput) {
      setErrorLogin('Por favor, rellena email y contraseña.')
      return
    }
    const nombreUsuario = emailInput.split('@')[0]
    setUsuario({ email: emailInput, nombre: nombreUsuario.toUpperCase() })
    setErrorLogin('')
  }

  const handleLogout = () => {
    setUsuario(null)
    setEmailInput('')
    setPassInput('')
  }

  const toggleFichaje = () => {
    const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (!fichado) {
      setFichado(true)
      setHoraFichaje(ahora)
      alert(`⏰ Entrada fichada a las ${ahora}`)
    } else {
      setFichado(false)
      alert(`🛑 Salida fichada. Entrada previa: ${horaFichaje}`)
      setHoraFichaje(null)
    }
  }

  const toggleFaltaProducto = (nombreProd) => {
    if (listaFaltas.includes(nombreProd)) {
      setListaFaltas(listaFaltas.filter((item) => item !== nombreProd))
    } else {
      setListaFaltas([...listaFaltas, nombreProd])
    }
  }

  const agregarFaltaManual = () => {
    if (faltaTextoManual.trim()) {
      setListaFaltas([...listaFaltas, faltaTextoManual.trim()])
      setFaltaTextoManual('')
    }
  }

  const enviarAvisoJefes = () => {
    if (listaFaltas.length === 0) return
    alert(`📩 Aviso enviado a los jefes:\nFaltas acumuladas:\n- ${listaFaltas.join('\n- ')}`)
    setListaFaltas([])
    setModalStockAbierto(false)
  }

  const toggleApuntarseTurno = (turnoNombre) => {
    if (!usuario) return
    const listaActual = turnos[turnoNombre] || []
    const yaApuntado = listaActual.includes(usuario.nombre)

    let nuevaLista = []
    if (yaApuntado) {
      nuevaLista = listaActual.filter((n) => n !== usuario.nombre)
    } else {
      nuevaLista = [...listaActual, usuario.nombre]
    }

    setTurnos({ ...turnos, [turnoNombre]: nuevaLista })
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

  const agregarAlTicket = (prod) => {
    const actual = comandasPorMesa[claveMesaActual] || []
    const existe = actual.find((i) => i.id === prod.id)

    let nuevaComanda = []
    if (existe) {
      nuevaComanda = actual.map((i) => (i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      nuevaComanda = [...actual, { ...prod, cantidad: 1 }]
    }

    setComandasPorMesa({ ...comandasPorMesa, [claveMesaActual]: nuevaComanda })
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

      // Limpiar ticket local tras enviar
      const copComandas = { ...comandasPorMesa }
      delete copComandas[claveMesaActual]
      setComandasPorMesa(copComandas)

      alert(`✅ ¡Comanda enviada a la pantalla principal!`)
      setVerComandaMobile(false)
    } catch (err) {
      alert(`❌ Error al enviar: ${err.message || 'Sin conexión'}`)
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)
  const opcionesMesas = Array.from({ length: 20 }, (_, i) => i + 1)

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl block mb-2">📱</span>
            <h1 className="text-2xl font-black text-amber-500 uppercase tracking-wider">JORCO FUSIÓN</h1>
            <p className="text-xs text-slate-400 font-medium">Terminal PDA Camarero</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Usuario / Email</label>
              <input
                type="text"
                placeholder="camarero@jorco.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {errorLogin && <p className="text-xs text-rose-500 font-bold text-center">{errorLogin}</p>}

            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase rounded-xl shadow-lg shadow-amber-500/10 active:scale-95 transition"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-20">
      
      {/* BARRA SUPERIOR */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center sticky top-0 z-30">
        <button
          onClick={() => setModalMesaAbierto(true)}
          className="bg-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1 active:scale-95 transition shadow"
        >
          <span>📍 {zonaActiva} - {obtenerNombreMesa(mesaNum)}</span>
          <span className="text-[10px]">▼</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalStockAbierto(true)}
            title="Stock"
            className="p-2 bg-slate-800 text-amber-400 rounded-xl text-xs border border-slate-700"
          >
            📦
          </button>

          <button
            onClick={() => setModalTurnosAbierto(true)}
            title="Turnos"
            className="p-2 bg-slate-800 text-amber-400 rounded-xl text-xs border border-slate-700"
          >
            📅
          </button>

          <button
            onClick={toggleFichaje}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition border ${
              fichado
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}
          >
            {fichado ? `⏰ ${horaFichaje}` : '⏹️ Fichar'}
          </button>

          <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 font-bold text-xs p-1">
            ✕
          </button>
        </div>
      </header>

      {/* INPUT ALIAS CLIENTE */}
      <div className="bg-slate-900/50 p-2 border-b border-slate-800/80 flex items-center gap-2 px-3">
        <span className="text-xs">👤</span>
        <input
          type="text"
          placeholder="Nombre o descripción (ej: Gorra roja)"
          value={aliasActual}
          onChange={(e) => setAliasPorMesa({ ...aliasPorMesa, [claveMesaActual]: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs font-bold text-amber-300 placeholder-slate-600 focus:outline-none"
        />
      </div>

      {/* FAMILIAS */}
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

      {/* PRODUCTOS */}
      <div className="p-2 grid grid-cols-2 gap-2 flex-1 overflow-y-auto">
        {productosFiltrados.map((p) => (
          <button
            key={p.id}
            onClick={() => agregarAlTicket(p)}
            className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-3 rounded-2xl flex flex-col justify-between h-28 active:scale-95 transition text-left"
          >
            <div className="flex justify-between items-start w-full">
              <span className="font-extrabold text-xs text-slate-200 line-clamp-2">{p.nombre}</span>
              <span className="text-xl">{p.img || '🍽️'}</span>
            </div>
            <div className="flex justify-between items-end w-full border-t border-slate-800/60 pt-1.5">
              <span className="text-[9px] font-black uppercase text-slate-500">{p.destino}</span>
              <span className="font-black text-sm text-amber-400">{Number(p.precio).toFixed(2)}€</span>
            </div>
          </button>
        ))}
      </div>

      {/* BARRA FLOTANTE ENVIAR */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-2 z-20">
        <button
          onClick={() => setVerComandaMobile(true)}
          className="flex-1 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-2xl flex justify-between items-center"
        >
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full">
              {comandaActual.reduce((s, i) => s + i.cantidad, 0)}
            </span>
            <span className="text-xs font-bold text-slate-300">Ver Pedido</span>
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

      {/* MODAL COMANDA */}
      {verComandaMobile && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex flex-col p-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <h2 className="font-black text-amber-500 text-base uppercase">
                {zonaActiva} - {obtenerNombreMesa(mesaNum)}
              </h2>
              {aliasActual && <p className="text-xs text-amber-300 font-bold">👤 {aliasActual}</p>}
            </div>
            <button
              onClick={() => setVerComandaMobile(false)}
              className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-2">
            {comandaActual.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10">No hay productos en esta mesa.</p>
            ) : (
              comandaActual.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-100 block">{item.nombre}</span>
                    <span className="text-[10px] text-slate-400">{Number(item.precio).toFixed(2)}€ / ud</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                      <button
                        onClick={() => cambiarCantidad(item.id, -1)}
                        className="w-6 h-6 bg-rose-500/20 text-rose-400 font-black rounded-lg text-xs"
                      >
                        -
                      </button>
                      <span className="font-black text-xs px-2">{item.cantidad}</span>
                      <button
                        onClick={() => cambiarCantidad(item.id, 1)}
                        className="w-6 h-6 bg-emerald-500/20 text-emerald-400 font-black rounded-lg text-xs"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-black text-sm text-amber-400 w-14 text-right">
                      {(item.precio * item.cantidad).toFixed(2)}€
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-base font-black">
              <span>TOTAL</span>
              <span className="text-amber-400 text-xl">{calcularTotal().toFixed(2)}€</span>
            </div>
            <button
              onClick={enviarComandaBD}
              disabled={comandaActual.length === 0}
              className="w-full py-4 bg-amber-500 disabled:opacity-30 text-slate-950 font-black text-sm uppercase rounded-2xl shadow-xl active:scale-95 transition"
            >
              🚀 ENVIAR A TPV PRINCIPAL
            </button>
          </div>
        </div>
      )}

      {/* MODAL MESA */}
      {modalMesaAbierto && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-amber-500 text-sm uppercase">Seleccionar Ubicación</h2>
              <button
                onClick={() => setModalMesaAbierto(false)}
                className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => setZonaActiva(z)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition ${
                    zonaActiva === z ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
              {opcionesMesas.map((n) => {
                const esSeleccionada = mesaNum === n
                const nombreVisual = obtenerNombreMesa(n)
                return (
                  <div
                    key={n}
                    onClick={() => {
                      setMesaNum(n)
                      setModalMesaAbierto(false)
                    }}
                    className={`p-3 rounded-2xl border text-center relative flex flex-col justify-center items-center h-20 ${
                      esSeleccionada
                        ? 'bg-amber-500 border-amber-400 text-slate-950 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-300 font-bold'
                    }`}
                  >
                    <span className="text-xs uppercase leading-tight line-clamp-2">{nombreVisual}</span>
                    <button
                      onClick={(e) => renombrarMesa(n, e)}
                      className="absolute top-1 right-1 text-[10px] opacity-60 hover:opacity-100 p-1"
                    >
                      ✏️
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL STOCK */}
      {modalStockAbierto && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-amber-500 text-sm uppercase">📦 Reportar Faltas / Stock</h2>
              <button
                onClick={() => setModalStockAbierto(false)}
                className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 max-h-[40vh] overflow-y-auto">
              {productos.map((p) => {
                const marcado = listaFaltas.includes(p.nombre)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleFaltaProducto(p.nombre)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                      marcado
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    {marcado ? '❌ ' : '✔️ '} {p.nombre}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Otra falta manual"
                value={faltaTextoManual}
                onChange={(e) => setFaltaTextoManual(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
              />
              <button onClick={agregarFaltaManual} className="bg-slate-800 px-3 py-2 rounded-xl text-xs font-bold">
                +
              </button>
            </div>
          </div>

          <button
            onClick={enviarAvisoJefes}
            disabled={listaFaltas.length === 0}
            className="w-full py-3.5 bg-rose-600 disabled:opacity-30 text-white font-black text-xs uppercase rounded-xl shadow-lg"
          >
            📩 ENVIAR AVISO A JEFES ({listaFaltas.length})
          </button>
        </div>
      )}

      {/* MODAL TURNOS */}
      {modalTurnosAbierto && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-amber-500 text-sm uppercase">📅 Turnos de Trabajo</h2>
              <button
                onClick={() => setModalTurnosAbierto(false)}
                className="w-8 h-8 bg-slate-800 text-slate-300 font-bold rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {Object.keys(turnos).map((t) => {
                const apuntados = turnos[t] || []
                const yoApuntado = apuntados.includes(usuario?.nombre)

                return (
                  <div key={t} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-xs text-slate-200">{t}</h3>
                      <p className="text-[10px] text-slate-500">
                        {apuntados.length > 0 ? `Apuntados: ${apuntados.join(', ')}` : 'Nadie apuntado'}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleApuntarseTurno(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition ${
                        yoApuntado
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {yoApuntado ? 'Desapuntarme' : 'Apuntarme'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
