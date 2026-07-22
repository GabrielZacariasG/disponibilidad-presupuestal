import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const cuentasParam = searchParams.get('cuentas');

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Faltan fechas desde/hasta' }, { status: 400 });
  }

  let cuentasFiltro = null;
  if (cuentasParam) {
    cuentasFiltro = cuentasParam.split(',').filter(Boolean);
  }

  let todasLasFilas = [];
  let offset = 0;
  const tamanoPagina = 1000;

  while (true) {
    let query = supabaseAdmin
      .from('disponibilidad_cuenta_dia')
      .select('fecha, cuenta, presupuesto, gasto, comprometido, precomprometido, disponible')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .range(offset, offset + tamanoPagina - 1);

    if (cuentasFiltro && cuentasFiltro.length > 0) {
      query = query.in('cuenta', cuentasFiltro);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    todasLasFilas = todasLasFilas.concat(data);
    if (data.length < tamanoPagina) break;
    offset += tamanoPagina;
  }

  return NextResponse.json(todasLasFilas);
}
