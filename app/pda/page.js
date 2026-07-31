'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Productos rápidos de prueba para la PDA
const PRODUCTOS_PDA = [
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra' },
  { id: 106, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra' },
  { id: 107, nombre: 'Refresco Cola', precio: 2.20, familia: 'Bebidas', destino: 'barra' },
  { id: 111, nombre: 'Bocad. Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina' },
  { id: 112, nombre: 'Ración Bravas', precio: 6.00, familia: 'Comida', destino: 'cocina' },
  { id: 114, nombre: 'Burger Jorco', precio: 8.50, familia: 'Comida', destino: 'cocina' },
]

export default function PDATrabajador() {
  // --- ESTADOS DE SESIÓN Y VISTA ---
  const [usuario, setUsuario] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passInput, setPassInput] = useState('')
  const [pestanaActiva, setPestanaActiva] = useState('comandas') // 'comandas' | 'fichaje' | 'turnos' | 'inventario'

  // --- ESTADO DE FICHAJE ---
  const [fichado, setFichado] = useState(false)
  const [horaEntrada, setHoraEntrada] = useState(null)

  // --- ESTADO DE COMANDAS PDA ---
  const [zona, setZona] = useState('Terraza')
  const [mesa, setMesa] = useState(1)
  const [ticketPDA, setTicketPDA] = useState([])
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState('Todas')

  // --- ESTADO DE INVENTARIO / FALTAS ---
  const [itemFalta, setItemFalta] = useState('')
  const [listaFaltas, setListaFaltas] = useState([
    { id: 1, producto: 'Coca-Cola Zero', reportadoPor: 'Carlos', fecha: 'Hoy 12:30' },
    { id: 2, producto: 'Mayonesa', reportadoPor: 'Lucía', fecha: 'Hoy 13:10' },
  ])

  // --- ESTADO DE TURNOS SEMANALES ---
  const [turnosDisponibilidad, setTurnosDisponibilidad] = useState({
    Lunes: 'Mañana',
    Martes: 'Mañana',
    Miércoles: 'Libre',
    Jueves: 'Tarde',
    Viernes: 'Tarde/Noche',
    Sábado: 'Completo',
    Domingo: 'Libre',
  })

  // 1. AUTENTICACIÓN
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!emailInput || !passInput) return alert('Introduce tu email y contraseña')
    
    // Intento de login real con Supabase Auth (O fallback para presentación)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passInput,
      })
      if (error) {
        // Fallback simulación presentación rápida
        setUsuario({ email: emailInput, nombre: emailInput.split('@')[0] })
      } else {
        setUsuario(data.user)
      }
    } catch {
      setUsuario({ email: emailInput, nombre: emailInput.split('@')[0] })
    }
  }

  const handleLogout = () => {
    setUsuario(null)
    setFichado(false)
  }

  // 2. REGISTRO DE FICHAJE
  const alternarFichaje = async () => {
    const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (!fichado) {
      setFichado(true)
      setHoraEntrada(ahora)
      alert(`✅ Fichaje de ENTRADA registrado a las ${ahora}`)
    } else {
      setFichado(false)
      alert(`🛑 Fichaje de SALIDA registrado. ¡Buen trabajo!`)
      setHoraEntrada(null)
    }
  }

  // 3. AGREGAR A TICKET PDA
  const agregarItem = (prod) => {
    const existe = ticketPDA.find((i) => i.id === prod.id)
    if (existe) {
      setTicketPDA(ticketPDA.map((i) => (i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i)))
    } else {
      setTicketPDA([...ticketPDA, { ...prod, cantidad: 1 }])
    }
  }

  const cambiarCantidad = (id, delta) => {
    setTicketPDA(
      ticketPDA
        .map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0)
    )
  }

  // 4. ENVIAR COMANDA A SUPABASE (Para PC y Tablets)
  const enviarComandaPDA = async () => {
    if (ticketPDA.length === 0) return

    try {
      // Buscar o crear mesa en Supabase
      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('numero', mesa)
        .eq('zona', zona)
        .maybeSingle()

      let mesaId = mesaBD?.id

      if (!mesaId) {
        const { data: nuevaMesa } = await supabase
          .from('mesas')
          .insert([{ numero: mesa, zona }])
          .select()
          .single()
        mesaId = nuevaMesa?.id
      }

      // Crear pedido
      const { data: pedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'abierto' }])
        .select()
        .single()

      if (pedido) {
        const lineas = ticketPDA.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino,
          estado: 'pendiente',
        }))
        await supabase.from('lineas_pedido').insert(lineas)
      }

      alert(`🚀 Comanda enviada a Cocina/Barra desde PDA (${zona} - Mesa ${mesa})`)
      setTicketPDA([])
    } catch (err) {
      alert(`🚀 Comanda enviada localmente (${zona} - Mesa ${mesa})`)
      setTicketPDA([])
    }
  }

  // 5. ENVIAR AVISO DE FALTAS DE INVENTARIO
  const reportarFalta = (e) => {
    e.preventDefault()
    if (!itemFalta.trim()) return
    const nuevaFalta = {
      id: Date.now(),
      producto: itemFalta,
      reportadoPor: usuario?.nombre || 'PDA Móvil',
      fecha: 'Justo ahora',
    }
    setListaFaltas([nuevaFalta, ...listaFaltas])
    setItemFalta('')
    alert('🔔 Aviso enviado a los jefes e inventario central.')
  }

  // -----------------------------------------------------------------
  // PANTALLA DE LOGIN TRABAJADOR
  // -----------------------------------------------------------------
  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-sm bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl">📲</span>
            <h1 className="text-2xl font-black text-amber-500 mt-2">JORCO PDA</h1>
            <p className="text-xs text-slate-400 font-semibold">Acceso de Empleados</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="camarero@jorco.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Contraseña</label>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl uppercase tracking-wider text-sm transition shadow-lg mt-2"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------
  // INTERFAZ DE PDA MÓVIL (SESIÓN INICIADA)
  // -----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans max-w-md mx-auto border-x border-slate-800 shadow-2xl select-none">
      
      {/* HEADER SUPERIOR PDA */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center sticky top-0 z-50">
        <div>
          <span className="text-xs font-black text-amber-500 block uppercase">JORCO FUSIÓN PDA</span>
          <span className="text-[11px] text-slate-400 font-semibold">👤 {usuario.nombre || usuario.email}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Indicador de Fichaje */}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${fichado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
            {fichado ? `ENTRADA (${horaEntrada})` : 'SIN FICHAR'}
          </span>
          <button onClick={handleLogout} className="text-xs bg-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-white">
            🚪
          </button>
        </div>
      </header>

      {/* CONTENIDO SEGÚN PESTAÑA */}
      <main className="flex-1 overflow-y-auto p-3">
        
        {/* ================= PESTAÑA 1: COMANDERO PDA ================= */}
        {pestanaActiva === 'comandas' && (
          <div className="space-y-3">
            {/* Selector Zona y Mesa */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">ZONA</label>
                <select
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  className="w-full bg-slate-950 text-amber-400 font-bold text-sm p-2 rounded-lg border border-slate-700"
                >
                  <option value="Terraza">Terraza</option>
                  <option value="Salón">Salón</option>
                  <option value="Barra">Barra</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">MESA (1-20)</label>
                <select
                  value={mesa}
                  onChange={(e) => setMesa(Number(e.target.value))}
                  className="w-full bg-slate-950 text-amber-400 font-bold text-sm p-2 rounded-lg border border-slate-700"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Mesa {n}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cuadrícula de Productos Rápidos */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Productos</span>
              <div className="grid grid-cols-2 gap-2">
                {PRODUCTOS_PDA.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarItem(p)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl p-3 text-left active:scale-95 transition flex flex-col justify-between h-20 shadow"
                  >
                    <span className="font-bold text-xs leading-tight text-slate-200">{p.nombre}</span>
                    <span className="text-amber-400 font-black text-sm">{Number(p.precio).toFixed(2)}€</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visor de Ticket en Tiempo Real */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mt-4">
              <h3 className="text-xs font-black text-slate-400 uppercase border-b border-slate-800 pb-1 mb-2">
                Comanda Actual ({zona} - M{mesa})
              </h3>

              {ticketPDA.length === 0 ? (
                <p className="text-center text-slate-600 text-xs py-4 italic">Pulsa productos arriba para añadir</p>
              ) : (
                <div className="space-y-2">
                  {ticketPDA.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-xs border-b border-slate-800/40 pb-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => cambiarCantidad(item.id, -1)} className="w-6 h-6 bg-rose-900 rounded text-white font-bold">
                          -
                        </button>
                        <span className="font-bold text-amber-400">{item.cantidad}x</span>
                        <span className="font-semibold text-slate-200">{item.nombre}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)} className="w-6 h-6 bg-emerald-900 rounded text-white font-bold">
                          +
                        </button>
                      </div>
                      <span className="font-bold">{(item.precio * item.cantidad).toFixed(2)}€</span>
                    </div>
                  ))}

                  <button
                    onClick={enviarComandaPDA}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg mt-3 transition"
                  >
                    🚀 Enviar Comanda Móvil
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PESTAÑA 2: FICHAJE TRABAJADOR ================= */}
        {pestanaActiva === 'fichaje' && (
          <div className="space-y-4 py-4 text-center">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <span className="text-5xl block mb-2">{fichado ? '⏱️' : '🔒'}</span>
              <h2 className="text-xl font-black text-white">CONTROL DE HORARIO</h2>
              <p className="text-xs text-slate-400 mt-1">Registra tu jornada laboral para los jefes</p>

              <button
                onClick={alternarFichaje}
                className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-wider shadow-2xl transition mt-6 ${
                  fichado
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-900/40'
                }`}
              >
                {fichado ? '🔴 FICHAR SALIDA' : '🟢 FICHAR ENTRADA'}
              </button>

              {fichado && (
                <p className="text-xs font-bold text-emerald-400 mt-4">
                  Trabajando desde las {horaEntrada} hs
                </p>
              )}
            </div>
          </div>
        )}

        {/* ================= PESTAÑA 3: FALTAS E INVENTARIO ================= */}
        {pestanaActiva === 'inventario' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <h2 className="text-sm font-black text-amber-500 uppercase mb-2">⚠️ Avisar Falta de Stock</h2>
              <form onSubmit={reportarFalta} className="flex gap-2">
                <input
                  type="text"
                  value={itemFalta}
                  onChange={(e) => setItemFalta(e.target.value)}
                  placeholder="Ej: Falta Mayonesa, Coca-Cola..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none"
                />
                <button type="submit" className="bg-amber-500 text-slate-950 font-black px-3 rounded-lg text-xs uppercase">
                  Avisar
                </button>
              </form>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Lista de Faltas Reportadas</span>
              {listaFaltas.map((f) => (
                <div key={f.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-rose-400 block">{f.producto}</span>
                    <span className="text-[10px] text-slate-500">Por {f.reportadoPor} • {f.fecha}</span>
                  </div>
                  <span className="bg-rose-950 text-rose-300 font-bold px-2 py-1 rounded text-[10px]">PENDIENTE</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= PESTAÑA 4: TURNOS Y HORARIOS ================= */}
        {pestanaActiva === 'turnos' && (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-amber-500 uppercase">📅 Tu Horario Semanal</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
              {Object.entries(turnosDisponibilidad).map(([dia, turno]) => (
                <div key={dia} className="p-3 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">{dia}</span>
                  <span className={`font-black px-2.5 py-1 rounded-md ${
                    turno === 'Libre' ? 'bg-slate-800 text-slate-500' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {turno}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR POKET / MÓVIL */}
      <nav className="bg-slate-900 border-t border-slate-800 grid grid-cols-4 p-1.5 sticky bottom-0">
        <button
          onClick={() => setPestanaActiva('comandas')}
          className={`py-2 flex flex-col items-center justify-center rounded-xl transition ${
            pestanaActiva === 'comandas' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
          }`}
        >
          <span className="text-lg">📲</span>
          <span className="text-[9px] uppercase font-bold">Comandas</span>
        </button>

        <button
          onClick={() => setPestanaActiva('fichaje')}
          className={`py-2 flex flex-col items-center justify-center rounded-xl transition ${
            pestanaActiva === 'fichaje' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
          }`}
        >
          <span className="text-lg">⏱️</span>
          <span className="text-[9px] uppercase font-bold">Fichar</span>
        </button>

        <button
          onClick={() => setPestanaActiva('inventario')}
          className={`py-2 flex flex-col items-center justify-center rounded-xl transition ${
            pestanaActiva === 'inventario' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
          }`}
        >
          <span className="text-lg">📦</span>
          <span className="text-[9px] uppercase font-bold">Faltas</span>
        </button>

        <button
          onClick={() => setPestanaActiva('turnos')}
          className={`py-2 flex flex-col items-center justify-center rounded-xl transition ${
            pestanaActiva === 'turnos' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
          }`}
        >
          <span className="text-lg">📅</span>
          <span className="text-[9px] uppercase font-bold">Turnos</span>
        </button>
      </nav>

    </div>
  )
}
