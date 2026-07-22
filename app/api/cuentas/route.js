import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const fetchCache = 'force-no-store';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('catalogo_cuentas')
    .select('cuenta, descripcion, categoria, capitulo, tipo')
    .order('cuenta');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
