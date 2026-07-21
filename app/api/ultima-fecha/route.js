import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('disponibilidad_cuenta_dia')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ fecha: null });
  }
  return NextResponse.json({ fecha: data[0].fecha });
}
