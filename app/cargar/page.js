import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { fecha, filas } = await request.json();

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Fecha inválida o faltante.' }, { status: 400 });
    }
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No llegaron filas para guardar.' }, { status: 400 });
    }

    const registros = filas.map((f) => ({
      fecha,
      cuenta: String(f.cuenta),
      presupuesto: f.presupuesto || 0,
      gasto: f.gasto || 0,
      comprometido: f.comprometido || 0,
      precomprometido: f.precomprometido || 0,
      disponible: f.disponible || 0,
    }));

    const { error } = await supabaseAdmin
      .from('disponibilidad_cuenta_dia')
      .upsert(registros, { onConflict: 'fecha,cuenta' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exito: true, filasGuardadas: registros.length });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
