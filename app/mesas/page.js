'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function MapaMesas() {
  const [mesas, setMesas] = useState([]);
  const [filtroZona, setFiltroZona] = useState('todas');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarMesas();
  }, []);

  const cargarMesas = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('mesas')
      .select('*')
      .order('numero', { ascending: true });

    if (error) {
      console.error('Error al cargar mesas:', error);
    } else if (data) {
      setMesas(data);
    }
    setCargando(false);
  };

  // Filtrado flexible para terraza, salón y barra
  const mesasFiltradas = filtroZona === 'todas'
    ? mesas
    : mesas.filter((m) => {
        const zona = m.zona?.toLowerCase() || '';
        if (filtroZona === 'salon') return zona.includes('sal') || zona.includes('comedor');
        return zona.includes(filtroZona);
      });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Cabecera y Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black text-amber-500">
            🗺️ PLANO DE MESAS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Total: {mesas.length} mesas configuradas
          </p>
        </div>

        {/* Botones de Filtrado por Zona */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'terraza', label: '☀️ Terraza' },
            { id: 'salon', label: '🛋️ Salón' },
            { id: 'barra', label: '🍺 Barra' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroZona(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                filtroZona === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Mesas */}
      {cargando ? (
        <div className="flex justify-center items-center h-64 text-slate-400 font-semibold">
          Cargando el plano del local...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {mesasFiltradas.map((mesa) => {
            const estaOcupada = mesa.estado === 'ocupada';

            return (
              <Link
                key={mesa.id}
                href={`/pda?mesa=${mesa.id}`}
                className={`p-5 rounded-2xl border-2 flex flex-col justify-between items-center aspect-square transition duration-200 shadow-xl hover:scale-[1.02] ${
                  estaOcupada
                    ? 'bg-red-950/30 border-red-500/80 text-red-200 hover:bg-red-900/40'
                    : 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 hover:bg-emerald-900/40'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {mesa.zona}
                </div>
                
                <div className="text-3xl font-black text-white my-2">
                  Mesa {mesa.numero}
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                    estaOcupada
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                      : 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                  }`}
                >
                  {estaOcupada ? 'Ocupada' : 'Libre'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
