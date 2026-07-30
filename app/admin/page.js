'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase';

export default function AdminPanel() {
  const [fichajes, setFichajes] = useState([])

  useEffect(() => {
    cargarFichajes()
  }, [])

  const cargarFichajes = async () => {
    const { data } = await supabase
      .from('fichajes')
      .select('*, profiles(nombre)')
      .order('entrada', { ascending: false })

    if (data) setFichajes(data)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-black text-amber-500 mb-6">Panel de Jefe - Control de Fichajes</h1>

      <div className="bg-slate-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-700 text-amber-400">
              <th className="p-3">Empleado</th>
              <th className="p-3">Entrada</th>
              <th className="p-3">Salida</th>
            </tr>
          </thead>
          <tbody>
            {fichajes.map((f) => (
              <tr key={f.id} className="border-b border-slate-700/50">
                <td className="p-3 font-semibold">{f.profiles?.nombre || 'Empleado'}</td>
                <td className="p-3 text-emerald-400">{new Date(f.entrada).toLocaleString()}</td>
                <td className="p-3 text-red-400">
                  {f.salida ? new Date(f.salida).toLocaleString() : 'En turno'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
