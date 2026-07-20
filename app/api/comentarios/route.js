import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const metrica = searchParams.get('metrica');

  if (!desde || !hasta || !metrica) {
    return NextResponse.json({ error: 'Faltan parámetros desde/hasta/metrica' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('comentarios_movimiento')
    .select('cuenta, comentario')
    .eq('fecha_desde', desde)
    .eq('fecha_hasta', hasta)
    .eq('metrica', metrica);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    const { cuenta, metrica, desde, hasta, comentario } = await request.json();

    if (!cuenta || !metrica || !desde || !hasta) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('comentarios_movimiento')
      .upsert(
        {
          cuenta,
          metrica,
          fecha_desde: desde,
          fecha_hasta: hasta,
          comentario: comentario || '',
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'cuenta,metrica,fecha_desde,fecha_hasta' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ exito: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
