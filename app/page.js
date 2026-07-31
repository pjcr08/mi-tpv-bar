'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Productos de prueba si Supabase no tiene registros
const PRODUCTOS_EJEMPLO = [
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra' },
  { id: 103, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra' },
  { id: 104, nombre: 'Refresco Cola', precio: 2.20, familia: 'Bebidas', destino: 'barra' },
  { id: 105, nombre: 'Agua 50cl', precio: 1.50, familia: 'Bebidas', destino: 'barra' },
  { id: 106, nombre: 'Bocadillo Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina' },
  { id: 107, nombre: 'Ración Bravas', precio: 6.00, familia: 'Comida', destino: 'cocina' },
  { id: 108, nombre: 'Tarta de Queso', precio: 4.00, familia: 'Postres', destino: 'cocina' },
]

export default function HomePrincipal() {
  const [familias, setFamilias] = useState([])
  const [familiaActiva, setFamiliaActiva] = useState('')
  const [productos, setProductos] = useState([])
  const [ticket, setTicket] = useState([])

  // Selección de Mesa
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)

  // Teclado numérico / Unidades
  const [multiplicador, setMultiplicador] = useState(1)

  useEffect(() => {
    cargarProductos()
  }, [])

  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase.from('productos').select('*')
      if (data && data.length > 0 && !error) {
        setProductos(data)
        const fams = [...new Set(data.map((p) => p.familia))].filter(Boolean)
        setFamilias(fams)
        if (fams.length > 0) setFamiliaActiva(fams[0])
      } else {
        usarProductosEjemplo()
      }
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

  const agregarAlTicket = (prod) => {
    const cantAgregar = multiplicador > 0 ? multiplicador : 1
    const existe = ticket.find((item) => item.id === prod.id)

    if (existe) {
      setTicket(
        ticket.map((item) =>
          item.id === prod.id
            ? { ...item, cantidad: item.cantidad + cantAgregar }
            : item
        )
      )
    } else {
      setTicket([...ticket, { ...prod, cantidad: cantAgregar }])
    }
    setMultiplicador(1)
  }

  const cambiarCantidadItem = (id, delta) => {
    setTicket(
      ticket
        .map((item) =>
          item.id === id ? { ...item, cantidad: item.cantidad + delta } : item
        )
        .filter((item) => item.cantidad > 0)
    )
  }

  const calcularTotal = () => {
    return ticket.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)
  }

  const presionarTeclado = (num) => {
    if (num === 'C') {
      setMultiplicador(1)
    } else {
      const nuevoVal = multiplicador === 1 ? String(num) : String(multiplicador) + String(num)
      setMultiplicador(Number(nuevoVal))
    }
  }

  // Obtiene el ID de la mesa existente o la inserta si no existe en Supabase
  const obtenerO CrearMesa = async () => {
    try {
      const { data: mesaBD } = await supabase
        .from('mesas')
        .select('id')
        .eq('numero', mesaNum)
        .eq('zona', zonaActiva)
        .maybeSingle()

      if (mesaBD) return mesaBD.id

      // Si la mesa no existe en la BD, la creamos
      const { data: nuevaMesa } = await supabase
        .from('mesas')
        .insert([{ numero: mesaNum, zona: zonaActiva }])
        .select()
        .single()

      return nuevaMesa ? nuevaMesa.id : null
    } catch {
      return null
    }
  }

  // ENVIAR COMANDA A COCINA/BARRA
  const enviarComanda = async () => {
    if (ticket.length === 0) return

    try {
      const mesaId = await obtenerO CrearMesa()

      // 1. Crear el pedido
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'pendiente' }])
        .select()
        .single()

      if (errPedido) {
        alert(`Error al crear pedido: ${errPedido.message}`)
        return
      }

      // 2. Crear las líneas de pedido
      if (pedido) {
        const lineas = ticket.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'pendiente',
        }))

        const { error: errLineas } = await supabase.from('lineas_pedido').insert(lineas)

        if (errLineas) {
          alert(`Error en líneas de pedido: ${errLineas.message}`)
          return
        }
      }

      setTicket([])
      setMultiplicador(1)
      alert('📝 ¡Comanda enviada a Cocina/Barra!')
    } catch (err) {
      console.error(err)
      alert('Error inesperado al enviar la comanda.')
    }
  }

  // COBRAR E IMPRIMIR TICKET
  const cobrarEImprimir = async () => {
    if (ticket.length === 0) return

    try {
      window.print()

      const mesaId = await obtenerO CrearMesa()

      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert([{ mesa_id: mesaId, estado: 'cobrado' }])
        .select()
        .single()

      if (pedido && !errPedido) {
        const lineas = ticket.map((item) => ({
          pedido_id: pedido.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: item.destino || 'barra',
          estado: 'cobrado',
        }))

        await supabase.from('lineas_pedido').insert(lineas)
      }

      setTicket([])
      setMultiplicador(1)
      alert('¡Cobro realizado con éxito!')
    } catch (err) {
      console.error(err)
      setTicket([])
      setMultiplicador(1)
      alert('Cobro registrado localmente')
    }
  }

  const productosFiltrados = productos.filter((p) => p.familia === familiaActiva)

  const rangosZona = {
    Terraza: { min: 1, max: 20 },
    Salón: { min: 21, max: 40 },
    Barra: { min: 41, max: 60 },
  }

  const opcionesMesas = []
  const { min, max } = rangosZona[zonaActiva] || { min: 1, max: 20 }
  for (let i = min; i <= max; i++) {
    opcionesMesas.push(i)
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-print, #ticket-print * { visibility: visible; }
          #ticket-print {
            position: absolute; left: 0; top: 0; width: 80mm;
            color: #000 !important; background: #fff !important;
            padding: 10px; font-family: monospace;
          }
          .no-imprimir { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row h-screen overflow-hidden font-sans no-imprimir select-none">
        
        {/* PANEL IZQUIERDO: TICKET Y TECLADO */}
        <div className="w-full lg:w-5/12 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-3">
          
          <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 flex justify-between items-center mb-2">
            <div className="flex gap-1">
              {['Terraza', 'Salón', 'Barra'].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setZonaActiva(z)
                    setMesaNum(rangosZona[z].min)
                  }}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${
                    zonaActiva === z
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">MESA:</span>
              <select
                value={mesaNum}
                onChange={(e) => setMesaNum(Number(e.target.value))}
                className="bg-slate-950 text-amber-400 font-black px-3 py-1.5 rounded-lg border border-slate-700 text-base"
              >
                {opcionesMesas.map((n) => (
                  <option key={n} value={n}>
                    Mesa {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* VISOR TICKET */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex-1 overflow-y-auto mb-2 min-h-[180px]">
            <div className="flex justify-between text-xs font-bold border-b border-slate-800 pb-1 mb-2 text-slate-400 uppercase">
              <span>Producto</span>
              <span>Cant / Total</span>
            </div>

            {ticket.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs italic py-8">
                Selecciona productos a la derecha para añadir al ticket
              </div>
            ) : (
              <div className="space-y-1.5">
                {ticket.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-sm border
