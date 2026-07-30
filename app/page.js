"use client";

import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function Home() {
  return (
    <main style={{ padding: '20px' }}>
      <h1>TPV Bar</h1>
      <ul>
        <li><Link href="/barra">Barra</Link></li>
        <li><Link href="/caja">Caja</Link></li>
        <li><Link href="/cocina">Cocina</Link></li>
      </ul>
    </main>
  );
}
