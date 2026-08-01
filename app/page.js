'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const PRODUCTOS_EJEMPLO = [
  { id: 101, nombre: 'Café Solo', precio: 1.20, familia: 'Cafés', destino: 'barra' },
  { id: 102, nombre: 'Café con Leche', precio: 1.40, familia: 'Cafés', destino: 'barra' },
  { id: 106, nombre: 'Caña Doble', precio: 2.50, familia: 'Bebidas', destino: 'barra' },
  { id: 111, nombre: 'Bocad. Jamón', precio: 4.50, familia: 'Comida', destino: 'cocina' },
  { id: 114, nombre: 'Burger Jorco', precio: 8.50, familia: 'Comida', destino: 'cocina' },
]

export default function PdaView() {
  const [zonaActiva, setZonaActiva] = useState('Terraza')
  const [mesaNum, setMesaNum] = useState(1)
  
  // ESTADO PARA RENOMBRAR MESAS
  const [nombresMesas, setNombresMesas] = useState({})
  
  const [productos, setProductos] = useState([])
  const [comanda, setComanda] = useState([])
  const [aliasCliente, setAliasCliente] = useState('')

  const claveMesaActual = `${zonaActiva}-${mesaNum}`

  const obtenerNombreMesa = (num) => {
    const clave = `${zonaActiva}-${num}`
    return nombresMesas[clave] || `Mesa ${num}`
  }

  const renombrarMesa = () => {
    const nombreActual = obtenerNombreMesa(mesaNum)
    const nuevoNombre = prompt(`Nuevo nombre para ${zonaActiva} - ${nombreActual}:`, nombreActual)

    if (nuevoNombre !== null && nuevoNombre.trim() !== '') {
      setNombresMesas({
        ...nombresMesas,
        [claveMesaActual]: nuevoNombre.trim(),
      })
    }
  }

  useEffect(() => {
    setProductos(PRODUCTOS_EJEMPLO)
  }, [])

  const opcionesMesas = Array.from({ length: 20 }, (_, i) => i + 1)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 font-sans">
      
      {/* CABECERA PDA */}
      <header className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="font-black text-amber-500 text-sm tracking-wider">JORCO FUSIÓN PDA</h1>
          <span className="text-[10px] text-slate-400">👤 camarero</span>
        </div>
        <button className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-1 rounded border border-red-500/30">
          SIN FICHAR
        </button>
      </header>

      {/* CONTROLES DE ZONA Y MESA */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* ZONA */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Zona</label>
          <select
            value={zonaActiva}
            onChange={(e) => setZonaActiva(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-bold p-2 rounded text-xs focus:outline-none"
          >
            <option value="Terraza">Terraza</option>
            <option value="Salón">Salón</option>
            <option value="Barra">Barra</option>
          </select>
        </div>

        {/* MESA + BOTÓN RENOMBRAR */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Mesa (1-20)</label>
            {/* BOTÓN ✏️ VISIBLE EN LA PDA */}
            <button
              onClick={renombrarMesa}
              className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30 active:scale-95 transition"
            >
              ✏️ Renombrar
            </button>
          </div>
          
          <select
            value={mesaNum}
            onChange={(e) => setMesaNum(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-bold p-2 rounded text-xs focus:outline-none"
          >
            {opcionesMesas.map((n) => (
              <option key={n} value={n}>
                {obtenerNombreMesa(n)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ALIAS / CLIENTE */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Ej: Gorra roja / Camiseta azul..."
          value={aliasCliente}
          onChange={(e) => setAliasCliente(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 font-medium px-2 py-1.5 rounded text-xs focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* SECCIÓN PRODUCTOS */}
      <div className="mb-3">
        <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Productos</span>
        <div className="grid grid-cols-2 gap-2">
          {productos.map((prod) => (
            <button
              key={prod.id}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-2 rounded text-left flex flex-col justify-between h-16 active:scale-95 transition"
            >
              <span className="font-bold text-xs text-slate-200">{prod.nombre}</span>
              <span className="font-black text-xs text-amber-400">{prod.precio.toFixed(2)}€</span>
            </button>
          ))}
        </div>
      </div>

      {/* RESUMEN COMANDA */}
      <div className="bg-slate-900 border border-slate-800 rounded p-2 text-center text-slate-500 text-xs italic">
        COMANDA ACTUAL ({zonaActiva.toUpperCase()} - {obtenerNombreMesa(mesaNum).toUpperCase()})
      </div>

    </div>
  )
}
