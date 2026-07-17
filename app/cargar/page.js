'use client';

import { useState } from 'react';

const UI_OBJETIVO = '10102';

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function limpiarNumero(v) {
  v = (v || '').trim();
  if (v === '' || v === '-') return 0;
  v = v.replace(/"/g, '').trim().replace(/,/g, '');
  if (v === '-' || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

async function procesarArchivo(file) {
  const buffer = await file.arrayBuffer();
  const texto = new TextDecoder('iso-8859-1').decode(buffer);
  const lineas = texto.split(/\r?\n/).filter((l) => l.length > 0);

  const lineaFecha = lineas[0];
  const matchFecha = lineaFecha.match(/Fecha Ejec:\s*(\d{2}\/\d{2}\/\d{4})/);
  if (!matchFecha) throw new Error('No encontré "Fecha Ejec:" en la primera línea. ¿Es el archivo correcto?');
  const [dd, mm, yyyy] = matchFecha[1].split('/');
  const fecha = `${yyyy}-${mm}-${dd}`;

  const datos = lineas.slice(9).map(parseCSVLine);
  const filasCrudo = datos.filter((r) => r[0] && r[0] !== 'Total General');

  const porCuenta = {};
  for (const r of filasCrudo) {
    const cuenta = (r[0] || '').trim();
    const ui = (r[3] || '').trim();
    if (ui !== UI_OBJETIVO) continue;
    if (!porCuenta[cuenta]) porCuenta[cuenta] = { presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
    porCuenta[cuenta].presupuesto += limpiarNumero(r[6]);
    porCuenta[cuenta].gasto += limpiarNumero(r[7]);
    porCuenta[cuenta].comprometido += limpiarNumero(r[8]);
    porCuenta[cuenta].precomprometido += limpiarNumero(r[9]);
    porCuenta[cuenta].disponible += limpiarNumero(r[10]);
  }

  const filas = Object.entries(porCuenta).map(([cuenta, v]) => ({ cuenta, ...v }));
  if (filas.length === 0) throw new Error('No encontré filas con Uni.Información 10102 en este archivo.');

  return { fecha, filas };
}

export default function CargarDia() {
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
      const { fecha, filas } = await procesarArchivo(archivo);
      const resp = await fetch('/api/cargar-dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, filas }),
      });
      const resultado = await resp.json();
      if (!resp.ok || resultado.error) {
        throw new Error(resultado.error || 'Error desconocido del servidor.');
      }
      setEstado({
        tipo: 'exito',
        texto: `Listo. Fecha ${fecha}: ${resultado.filasGuardadas} cuentas guardadas/actualizadas.`,
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
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>Cargar disponibilidad del día</h1>
        <p style={{ fontSize: 13, color: 'var(--texto-secundario)', margin: '0 0 1.5rem' }}>
          Sube el CSV de disponibilidad tal cual lo descargas del sistema (sin modificar). Se filtra automáticamente a las cuentas del hospital y se guarda.
        </p>

        <input
          type="file"
          accept=".csv"
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
          {cargando ? 'Procesando...' : 'Subir y actualizar'}
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
