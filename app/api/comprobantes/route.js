import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cuenta = searchParams.get('cuenta');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  if (!cuenta) {
    return NextResponse.json({ error: 'Falta el parámetro cuenta' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('comprobantes')
    .select('comprobante, proveedor, factura, fecha_contable, centro_costo, importe_cuenta')
    .eq('cuenta', cuenta)
    .order('fecha_contable', { ascending: true });

  if (desde) query = query.gte('fecha_contable', desde);
  if (hasta) query = query.lte('fecha_contable', hasta);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
