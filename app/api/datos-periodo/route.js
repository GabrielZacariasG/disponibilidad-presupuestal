import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get('fecha');
  const cuentasParam = searchParams.get('cuentas');

  if (!fecha || !cuentasParam) {
    return NextResponse.json({ error: 'Faltan parámetros fecha/cuentas' }, { status: 400 });
  }
  const cuentas = cuentasParam.split(',').filter(Boolean);

  const { data, error } = await supabaseAdmin
    .from('disponibilidad_cuenta_periodo_dia')
    .select('cuenta, periodo, presupuesto, gasto, comprometido, precomprometido, disponible')
    .eq('fecha', fecha)
    .in('cuenta', cuentas);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
