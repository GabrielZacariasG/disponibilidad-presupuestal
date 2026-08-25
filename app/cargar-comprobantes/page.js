'use client';

import { useState } from 'react';

const UI_OBJETIVO = '010102';

function formatearFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

async function procesarArchivo(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const nombreHoja = wb.SheetNames[0];
  const ws = wb.Sheets[nombreHoja];

  // La fila 1 es un título, los encabezados reales están en la fila 2 (índice 1)
  const filasCrudo = XLSX.utils.sheet_to_json(ws, { range: 1, defval: null });

  // Normalizar encabezados: el archivo real trae espacios de más en algunas columnas
  // (ej. " Importe Cuenta " en vez de "Importe Cuenta") — esto lo hace robusto a eso.
  const filas = filasCrudo.map((filaCruda) => {
    const filaLimpia = {};
    for (const clave in filaCruda) {
      filaLimpia[clave.trim()] = filaCruda[clave];
    }
    return filaLimpia;
  });

  const filtradas = filas.filter((f) => {
    const ui = f['Unidad de Información'];
    const estadoPpto = f['Estado Ppto'];
    return ui != null && String(ui).trim() === UI_OBJETIVO && estadoPpto === 'V';
  });

  if (filtradas.length === 0) {
    throw new Error(`No se encontraron filas con Unidad de Información = ${UI_OBJETIVO} y Estado Ppto = V. ¿Es el archivo correcto?`);
  }

  const resultado = filtradas.map((f) => ({
    comprobante: f['Comprobante'] ? String(f['Comprobante']).trim() : null,
    proveedor: f['Nombre Proveedor'] || null,
    factura: f['Factura'] || null,
    contrato: f['Contrato'] || null,
    fecha_emision: formatearFecha(f['Fecha Emision']),
    fecha_contable: formatearFecha(f['Fecha Contable']),
    centro_costo: f['Centro Costo'] ? String(f['Centro Costo']).trim() : null,
    cuenta: f['Cuenta'] ? String(f['Cuenta']).trim() : null,
    importe_cuenta: typeof f['Importe Cuenta'] === 'number' ? f['Importe Cuenta'] : parseFloat(f['Importe Cuenta']) || 0,
  })).filter((f) => f.cuenta);

  return resultado;
}

export default function CargarComprobantes() {
  const [archivo, setArchivo] = useState(null);
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function subir() {
    if (!archivo) {
      setEstado({ tipo: 'error', texto: 'Selecciona un archivo primero.' });
      return;
    }
    setCargando(true);
    setEstado(null);
    try {
      const filas = await procesarArchivo(archivo);

      const resp = await fetch('/api/cargar-comprobantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas }),
      });
      const resultado = await resp.json();
      if (!resp.ok || resultado.error) {
        throw new Error(resultado.error || 'Error desconocido del servidor.');
      }

      setEstado({
        tipo: 'exito',
        texto: `Listo. ${resultado.filasGuardadas} comprobantes guardados (Unidad ${UI_OBJETIVO}).`,
      });
      setArchivo(null);
    } catch (e) {
      setEstado({ tipo: 'error', texto: e.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ background: 'var(--imss-verde-oscuro)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--imss-verde-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, color: 'var(--imss-verde-oscuro)', flexShrink: 0 }}>
          IMSS
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--imss-verde-claro)' }}>Hospital General de Zona No. 02</p>
          <p style={{ margin: 0, fontSize: 12, color: '#C0DD97' }}>Departamento de Finanzas · Oficina de Presupuesto</p>
        </div>
      </div>

      <div style={{ padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Cargar reporte de comprobantes</h1>
        <p style={{ fontSize: 13, color: 'var(--texto-secundario)', margin: '0 0 1.5rem' }}>
          Sube el archivo tal cual lo descargas (formato .xls). Se guardan solo las filas con Unidad de Información = {UI_OBJETIVO} y Estado Ppto = V (válido presupuestalmente).
          Cada carga reemplaza por completo lo que había antes.
        </p>

        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => setArchivo(e.target.files[0])}
          style={{ marginBottom: '1rem', display: 'block' }}
        />

        <button
          onClick={subir}
          disabled={cargando}
          style={{
            padding: '9px 20px', background: 'var(--imss-verde)', color: 'white',
            border: 'none', borderRadius: 4, cursor: cargando ? 'not-allowed' : 'pointer',
            opacity: cargando ? 0.6 : 1,
          }}
        >
          {cargando ? 'Procesando...' : 'Subir y reemplazar'}
        </button>

        {estado && (
          <p
            style={{
              marginTop: '1rem', fontSize: 13,
              color: estado.tipo === 'error' ? '#A32D2D' : '#27500A',
            }}
          >
            {estado.texto}
          </p>
        )}

        <p style={{ marginTop: '2rem', fontSize: 12 }}>
          <a href="/" style={{ color: 'var(--imss-verde)' }}>← Volver al panel</a>
        </p>
      </div>
    </div>
  );
}
