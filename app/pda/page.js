'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PdaView() {
  const [usuario, setUsuario] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoAuth, setCargandoAuth] = useState(false)

  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  const [nombresMesas, setNombresMesas] = useState({})
  const [mesasOcupadasMap, setMesasOcupadasMap] = useState({})

  const [productos, setProductos] = useState([])
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('TODOS')
  const [cargandoProductos, setCargandoProductos] = useState(true)

  const [comandaActual, setComandaActual] = useState([])
  const [pedidoIdActual, setPedidoIdActual] = useState(null)
  const [aliasActual, setAliasActual] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [modalMesaAbierto, setModalMesaAbierto] = useState(false)
  const [verComandaMobile, setVerComandaMobile] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) setUsuario(session.user)
    }
    checkSession()
  }, [])

  useEffect(() => {
    cargarProductos()
    cargarNombresMesas()
    cargarMesasOcupadas()
  }, [])

  useEffect(() => {
    cargarPedidoMesaActual()
  }, [zonaActiva, mesaNum])

  // Escuchar cambios en tiempo real del ordenador central o cocina
  useEffect(() => {
    const channelGlobal = supabase
      .channel('pda-tpv-sync')
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
  }, [zonaActiva, mesaNum])

  const cargarProductos = async () => {
    setCargandoProductos(true)
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (error) throw error
      if (data) {
        setProductos(data)
        const fams = Array.from(new Set(data.map((p) => p.familia).filter(Boolean)))
        setFamilias(['TODOS', ...fams])
      }
    } catch (err) {
      console.error('Error cargando productos:', err)
    } finally {
      setCargandoProductos(false)
    }
  }

  const cargarNombresMesas = async () => {
    const { data } = await supabase.from('mesas').select('zona, numero, nombre_custom')
    if (data) {
      const mapa = {}
      data.forEach((m) => {
        if (m.nombre_custom) mapa[`${m.zona}-${m.numero}`] = m.nombre_custom
      })
      setNombresMesas(mapa)
    }
  }

  const cargarMesasOcupadas = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, mesa_id, mesas(zona, numero), lineas_pedido(precio, cantidad)')
      .eq('estado', 'abierto')

    if (!data) return
    const ocupadas = {}
    data.forEach((p) => {
      if (p.mesas) {
        const clave = `${p.mesas.zona}-${p.mesas.numero}`
        const totalMesa = p.lineas_pedido?.reduce((sum, l) => sum + Number(l.precio) * l.cantidad, 0) || 0
        if (totalMesa > 0) ocupadas[clave] = { pedidoId: p.id, total: totalMesa }
      }
    })
    setMesasOcupadasMap(ocupadas)
  }

  const cargarPedidoMesaActual = async () => {
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
      .order('id', { ascending: true })

    if (lineas) {
      setComandaActual(
        lineas.map((l) => ({
          id_linea: l.id,
          nombre: l.producto_nombre,
          precio: Number(l.precio),
          cantidad: l.cantidad,
          destino: l.destino || 'barra',
          estado: l.estado,
        }))
      )
    }
  }

  const obtenerNombreMesa = (num) => nombresMesas[`${zonaActiva}-${num}`] || `Mesa ${num}`

  // AÑADIR PRODUCTO E INSERTAR EN BASE DE DATOS INSTANTÁNEAMENTE
  const agregarAlTicket = async (prod) => {
    try {
      let pId = pedidoIdActual

      // Si no existe pedido abierto para la mesa, lo creamos
      if (!pId) {
        let { data: mesaBD } = await supabase
          .from('mesas')
          .select('id')
          .eq('numero', mesaNum)
          .eq('zona', zonaActiva)
          .maybeSingle()

        if (!mesaBD) {
          const { data: nuevaMesa } = await supabase
            .from('mesas')
            .insert([{ numero: mesaNum, zona: zonaActiva }])
            .select()
            .single()
          mesaBD = nuevaMesa
        }

        const { data: nuevoPedido } = await supabase
          .from('pedidos')
          .insert([{ mesa_id: mesaBD.id, estado: 'abierto', nota: aliasActual }])
          .select()
          .single()

        pId = nuevoPedido.id
        setPedidoIdActual(pId)
      }

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
            destino: prod.destino, // 'barra' o 'cocina' según la DB
            estado: 'borrador',
          },
        ])
      }

      // Refresco inmediato en la pantalla local de la PDA
      await cargarPedidoMesaActual()
      await cargarMesasOcupadas()
    } catch (err) {
      console.error('Error añadiendo producto:', err)
    }
  }

  // ENVIAR COMANDA A BARRA Y COCINA
  const enviarComandaBD = async () => {
    if (!pedidoIdActual) return
    setEnviando(true)

    try {
      // Cambiar estado a 'pendiente' para que el TPV Central y la pantalla de Cocina lo procesen
      await supabase
        .from('lineas_pedido')
        .update({ estado: 'pendiente' })
        .eq('pedido_id', pedidoIdActual)
        .eq('estado', 'borrador')

      await cargarPedidoMesaActual()
      setVerComandaMobile(false)
    } catch (err) {
      alert(`Error enviando comanda: ${err.message}`)
    } finally {
      setEnviando(false)
    }
  }

  const productosFiltrados = productos.filter((p) => {
    if (familiaActiva === 'TODOS') return true
    return p.familia === familiaActiva
  })

  const calcularTotal = () => comandaActual.reduce((s, i) => s + i.precio * i.cantidad, 0)

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setCargandoAuth(true)
            const { data, error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passInput })
            if (error) setErrorLogin('Error de credenciales')
            else setUsuario(data.user)
            setCargandoAuth(false)
          }}
          className="w-full max-w-xs bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4"
        >
          <h1 className="text-xl font-black text-amber-500 text-center uppercase">PDA CAMARERO</h1>
          <input
            type="email"
            placeholder="Email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs"
          />
          {errorLogin && <p className="text-xs text-rose-500 font-bold">{errorLogin}</p>}
          <button type="submit" className="w-full py-3 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-xl">
            {cargandoAuth ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-950 border-x border-slate-800/50 pb-20">
        
        {/* CABECERA Y SELECCIÓN DE MESA */}
        <header className="bg-slate-900/90 border-b border-slate-800 p-3 flex justify-between items-center sticky top-0 z-20">
          <button
            type="button"
            onClick={() => setModalMesaAbierto(true)}
            className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black px-3 py-1.5 rounded-xl text-xs uppercase"
          >
            📍 {zonaActiva} - {obtenerNombreMesa(mesaNum)} ▼
          </button>
          <span className="text-xs font-bold text-slate-400">{usuario.email}</span>
        </header>

        {/* ALIAS / NOTA */}
        <div className="p-2 bg-slate-900/40 border-b border-slate-800 flex items-center gap-2 px-3">
          <span className="text-xs">👤</span>
          <input
            type="text"
            placeholder="Nota o Cliente (ej: Gorra negra)"
            value={aliasActual}
            onChange={async (e) => {
              setAliasActual(e.target.value)
              if (pedidoIdActual) {
                await supabase.from('pedidos').update({ nota: e.target.value }).eq('id', pedidoIdActual)
              }
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-300 focus:outline-none"
          />
        </div>

        {/* FAMILIAS */}
        <div className="flex gap-2 p-2 overflow-x-auto bg-slate-950 border-b border-slate-800 no-scrollbar">
          {familias.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamiliaActiva(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase whitespace-nowrap ${
                familiaActiva === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* REJILLA DE PRODUCTOS (FUNCIONAN AL TOCAR) */}
        <div className="p-2.5 flex-1 overflow-y-auto">
          {cargandoProductos ? (
            <div className="text-center text-xs py-10 text-slate-500">Cargando la carta...</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {productosFiltrados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregarAlTicket(p)}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 active:border-amber-500 p-3 rounded-2xl flex flex-col justify-between h-24 text-left active:scale-95 transition cursor-pointer"
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-bold text-xs text-slate-100 line-clamp-2">{p.nombre}</span>
                    <span className="text-sm">{p.img || '🍴'}</span>
                  </div>
                  <div className="flex justify-between items-end w-full border-t border-slate-800/80 pt-1.5">
                    <span className={`text-[9px] font-black uppercase ${p.destino === 'cocina' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {p.destino}
                    </span>
                    <span className="font-black text-xs text-amber-400">{Number(p.precio).toFixed(2)}€</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* BARRA INFERIOR / ENVIAR COMANDA */}
        <div className="fixed bottom-0 max-w-md w-full p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 z-30">
          <button
            type="button"
            onClick={() => setVerComandaMobile(true)}
            className="flex-1 bg-slate-950 border border-slate-800 px-3 py-2.5 rounded-2xl flex justify-between items-center"
          >
            <span className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full">
              {comandaActual.reduce((s, i) => s + i.cantidad, 0)}
            </span>
            <span className="font-black text-amber-400 text-xs">{calcularTotal().toFixed(2)}€</span>
          </button>

          <button
            type="button"
            onClick={enviarComandaBD}
            disabled={!comandaActual.some((i) => i.estado === 'borrador') || enviando}
            className="bg-amber-500 disabled:opacity-30 text-slate-950 font-black px-4 py-3 rounded-2xl text-xs uppercase shadow-lg active:scale-95 transition"
          >
            {enviando ? '⏳...' : '🚀 ENVIAR'}
          </button>
        </div>

        {/* MODAL MESA */}
        {modalMesaAbierto && (
          <div className="fixed inset-0 bg-slate-950 z-50 p-4 flex flex-col max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-amber-500 text-xs uppercase">Seleccionar Ubicación</h2>
              <button type="button" onClick={() => setModalMesaAbierto(false)} className="text-lg">✕</button>
            </div>
            <div className="flex gap-1.5 mb-4">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZonaActiva(z)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase ${
                    zonaActiva === z ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
                const clave = `${zonaActiva}-${n}`
                const estaOcupada = Boolean(mesasOcupadasMap[clave])
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setMesaNum(n)
                      setModalMesaAbierto(false)
                    }}
                    className={`p-3 rounded-2xl border text-center flex flex-col justify-between items-center h-20 ${
                      mesaNum === n
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : estaOcupada
                        ? 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                        : 'bg-emerald-950/30 border-emerald-600/40 text-emerald-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase">{obtenerNombreMesa(n)}</span>
                    <span className="text-[9px] uppercase font-bold">{estaOcupada ? 'Ocupada' : 'Libre'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
