import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cuenta = searchParams.get('cuenta');
  const metrica = searchParams.get('metrica');

  if (!cuenta || !metrica) {
    return NextResponse.json({ error: 'Faltan parámetros cuenta/metrica' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('comentarios_movimiento')
    .select('fecha, comentario')
    .eq('cuenta', cuenta)
    .eq('metrica', metrica);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request) {
  try {
    const { cuenta, metrica, fecha, comentario } = await request.json();

    if (!cuenta || !metrica || !fecha) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('comentarios_movimiento')
      .upsert(
        {
          cuenta,
          metrica,
          fecha,
          comentario: comentario || '',
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'cuenta,metrica,fecha' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ exito: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
