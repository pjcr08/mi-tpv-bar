'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function ContenidoPDA() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mesaId = searchParams.get('mesa');

  const [mesa, setMesa] = useState(null);
  const [productos, setProductos] = useState([]);
  const [categoriaSel, setCategoriaSel] = useState('todas');
  const [carrito, setCarrito] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (mesaId) {
      cargarDatosIniciales();
    }
  }, [mesaId]);

  const cargarDatosIniciales = async () => {
    setCargando(true);

    // 1. Cargar información de la mesa
    const { data: dataMesa } = await supabase
      .from('mesas')
      .select('*')
      .eq('id', mesaId)
      .single();

    if (dataMesa) setMesa(dataMesa);

    // 2. Cargar productos disponibles
    const { data: dataProds } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });

    if (dataProds) setProductos(dataProds);

    setCargando(false);
  };

  // Añadir un producto a la comanda actual en pantalla
  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  // Restar o quitar un producto
  const quitarDelCarrito = (id) => {
    setCarrito((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item
        )
        .filter((item) => item.cantidad > 0)
    );
  };

  // Enviar pedido a Supabase (Cocina / Barra)
  const enviarComanda = async () => {
    if (carrito.length === 0 || !mesaId) return;

    try {
      setEnviando(true);

      // A. Buscar si la mesa ya tiene un pedido 'abierto'
      let { data: pedidoActual } = await supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('estado', 'abierto')
        .maybeSingle();

      // B. Si no hay pedido abierto, creamos uno nuevo
      if (!pedidoActual) {
        const { data: nuevoPedido, error: errPed } = await supabase
          .from('pedidos')
          .insert({ mesa_id: mesaId, estado: 'abierto' })
          .select()
          .single();

        if (errPed) throw errPed;
        pedidoActual = nuevoPedido;
      }

      // C. Preparar las líneas de pedido con destino (barra o cocina)
      const lineasAInsertar = carrito.flatMap((item) => {
        // Determinamos el destino según la categoría o propiedad del producto
        const cat = (item.categoria || '').toLowerCase();
        const esBarra = cat.includes('bebida') || cat.includes('barra') || cat.includes('cafe');
        const destino = item.destino || (esBarra ? 'barra' : 'cocina');

        return {
          pedido_id: pedidoActual.id,
          producto_nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          destino: destino,
          estado: 'pendiente'
        };
      });

      // D. Insertar las líneas en la base de datos
      const { error: errLineas } = await supabase
        .from('lineas_pedido')
        .insert(lineasAInsertar);

      if (errLineas) throw errLineas;

      // E. Marcar la mesa como 'ocupada'
      await supabase
        .from('mesas')
        .update({ estado: 'ocupada' })
        .eq('id', mesaId);

      // F. Limpiar y volver al mapa de mesas
      setCarrito([]);
      router.push('/mesas');
    } catch (err) {
      console.error('Error al enviar la comanda:', err);
      alert('Hubo un error al enviar el pedido.');
    } finally {
      setEnviando(false);
    }
  };

  const categorias = ['todas', ...new Set(productos.map((p) => p.categoria).filter(Boolean))];

  const productosFiltrados = categoriaSel === 'todas'
    ? productos
    : productos.filter((p) => p.categoria?.toLowerCase() === categoriaSel.toLowerCase());

  const totalCalculado = carrito.reduce(
    (acc, item) => acc + Number(item.precio) * item.cantidad,
    0
  );

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex justify-center items-center">
        Cargando comanda...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row">
      {/* LADO IZQUIERDO: Catálogo de productos */}
      <div className="w-full md:w-2/3 p-4 flex flex-col h-screen overflow-y-auto border-r border-slate-800">
        {/* Cabecera */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => router.push('/mesas')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold rounded-xl text-sm"
          >
            ← Volver a Mesas
          </button>
          <h1 className="text-xl font-black text-amber-500">
            {mesa ? `Mesa ${mesa.numero} (${mesa.zona})` : 'Comanda'}
          </h1>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSel(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap transition ${
                categoriaSel === cat
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {productosFiltrados.map((prod) => (
            <button
              key={prod.id}
              onClick={() => agregarAlCarrito(prod)}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col justify-between text-left transition active:scale-95"
            >
              <span className="font-bold text-white text-base leading-snug">
                {prod.nombre}
              </span>
              <span className="text-amber-400 font-black text-lg mt-2">
                {Number(prod.precio).toFixed(2)}€
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* LADO DERECHO: Resumen de comanda actual */}
      <div className="w-full md:w-1/3 bg-slate-900 p-4 flex flex-col justify-between h-screen border-t md:border-t-0 border-slate-800">
        <div>
          <h2 className="text-lg font-black text-amber-500 mb-3 border-b border-slate-800 pb-2">
            Comanda Actual
          </h2>

          <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
            {carrito.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                Selecciona productos para añadir al pedido
              </p>
            ) : (
              carrito.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center bg-slate-800 p-3 rounded-xl"
                >
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-sm">{item.nombre}</p>
                    <p className="text-xs text-amber-400">
                      {(Number(item.precio) * item.cantidad).toFixed(2)}€
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => quitarDelCarrito(item.id)}
                      className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-sm px-1">
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => agregarAlCarrito(item)}
                      className="w-8 h-8 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Total y Botón de Envío */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 text-sm font-bold">Total estimado:</span>
            <span className="text-2xl font-black text-amber-400">
              {totalCalculado.toFixed(2)}€
            </span>
          </div>

          <button
            onClick={enviarComanda}
            disabled={carrito.length === 0 || enviando}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-lg rounded-xl uppercase transition shadow-lg"
          >
            {enviando ? 'Enviando...' : '🚀 ENVIAR COMANDA'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PantallaPDA() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white p-6">Cargando PDA...</div>}>
      <ContenidoPDA />
    </Suspense>
  );
}
