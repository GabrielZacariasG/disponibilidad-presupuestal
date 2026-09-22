import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cuenta = searchParams.get('cuenta');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  if (!cuenta || !desde || !hasta) {
    return NextResponse.json({ error: 'Faltan parámetros cuenta/desde/hasta' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('disponibilidad_cuenta_centro_dia')
    .select('fecha, centro_costo, presupuesto, gasto, comprometido, precomprometido, disponible')
    .eq('cuenta', cuenta)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
