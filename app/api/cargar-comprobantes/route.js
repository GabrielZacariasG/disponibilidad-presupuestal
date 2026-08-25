import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { filas } = await request.json();

    if (!Array.isArray(filas)) {
      return NextResponse.json({ error: 'Formato inválido: se esperaba una lista de filas.' }, { status: 400 });
    }

    // Reemplazo completo: se borra todo lo anterior y se inserta la carga nueva.
    const { error: errorBorrar } = await supabaseAdmin
      .from('comprobantes')
      .delete()
      .neq('id', 0);

    if (errorBorrar) {
      return NextResponse.json({ error: 'Error al limpiar la tabla: ' + errorBorrar.message }, { status: 500 });
    }

    if (filas.length === 0) {
      return NextResponse.json({ exito: true, filasGuardadas: 0 });
    }

    const registros = filas.map((f) => ({
      comprobante: f.comprobante || null,
      proveedor: f.proveedor || null,
      factura: f.factura || null,
      contrato: f.contrato || null,
      fecha_emision: f.fecha_emision || null,
      fecha_contable: f.fecha_contable || null,
      centro_costo: f.centro_costo || null,
      cuenta: String(f.cuenta),
      importe_cuenta: f.importe_cuenta || 0,
    }));

    // Insertar en bloques para evitar límites de tamaño de payload
    const tamanoBloque = 500;
    let total = 0;
    for (let i = 0; i < registros.length; i += tamanoBloque) {
      const bloque = registros.slice(i, i + tamanoBloque);
      const { error } = await supabaseAdmin.from('comprobantes').insert(bloque);
      if (error) {
        return NextResponse.json({ error: `Error al insertar (bloque ${i}): ` + error.message }, { status: 500 });
      }
      total += bloque.length;
    }

    return NextResponse.json({ exito: true, filasGuardadas: total });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
