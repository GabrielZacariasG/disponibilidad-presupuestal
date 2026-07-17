'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const METRICAS = [
  { valor: 'presupuesto', etiqueta: 'Presupuesto' },
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'gasto', etiqueta: 'Gasto' },
  { valor: 'comprometido', etiqueta: 'Comprometido' },
  { valor: 'precomprometido', etiqueta: 'Precomprometido' },
];

function formatoMoneda(v) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v || 0);
}

export default function Panel() {
  const [cuentas, setCuentas] = useState([]);
  const [desde, setDesde] = useState('2026-07-01');
  const [hasta, setHasta] = useState('2026-07-17');
  const [cuentasSeleccionadas, setCuentasSeleccionadas] = useState([]);
  const [metrica, setMetrica] = useState('disponible');
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busquedaCuenta, setBusquedaCuenta] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/cuentas')
      .then((r) => r.json())
      .then(setCuentas)
      .catch((e) => setError('No se pudo cargar el catálogo de cuentas: ' + e.message));
  }, []);

  function buscarDatos() {
    setCargando(true);
    setError(null);
    const params = new URLSearchParams({ desde, hasta });
    if (cuentasSeleccionadas.length > 0) {
      params.set('cuentas', cuentasSeleccionadas.join(','));
    }
    fetch('/api/datos?' + params.toString())
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setDatos(d);
      })
      .catch((e) => setError('No se pudieron cargar los datos: ' + e.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    buscarDatos();
    // eslint-disable-next-line
  }, []);

  const cuentasFiltradas = useMemo(() => {
    if (!busquedaCuenta) return [];
    const q = busquedaCuenta.toLowerCase();
    return cuentas.filter(
      (c) => c.cuenta.includes(q) || (c.descripcion || '').toLowerCase().includes(q)
    );
  }, [cuentas, busquedaCuenta]);

  function alternarCuenta(cuenta) {
    setCuentasSeleccionadas((prev) =>
      prev.includes(cuenta) ? prev.filter((c) => c !== cuenta) : [...prev, cuenta]
    );
  }

  const catalogoPorCuenta = useMemo(() => {
    const m = {};
    cuentas.forEach((c) => (m[c.cuenta] = c));
    return m;
  }, [cuentas]);

  const fechasOrdenadas = useMemo(() => {
    const set = new Set(datos.map((f) => f.fecha));
    return Array.from(set).sort();
  }, [datos]);

  const cuentasConVariacion = useMemo(() => {
    const primeraFecha = fechasOrdenadas[0];
    const ultimaFecha = fechasOrdenadas[fechasOrdenadas.length - 1];
    const porCuenta = {};
    datos.forEach((fila) => {
      if (!porCuenta[fila.cuenta]) porCuenta[fila.cuenta] = {};
      if (fila.fecha === primeraFecha) porCuenta[fila.cuenta].inicio = fila[metrica];
      if (fila.fecha === ultimaFecha) porCuenta[fila.cuenta].fin = fila[metrica];
    });
    return Object.entries(porCuenta)
      .map(([cuenta, v]) => ({
        cuenta,
        descripcion: catalogoPorCuenta[cuenta]?.descripcion || 'Sin descripción',
        inicio: v.inicio || 0,
        fin: v.fin ?? v.inicio ?? 0,
        variacion: (v.fin ?? v.inicio ?? 0) - (v.inicio || 0),
      }))
      .filter((f) => f.variacion !== 0)
      .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
  }, [datos, fechasOrdenadas, metrica, catalogoPorCuenta]);

  const tablaResumen = useMemo(() => cuentasConVariacion.slice(0, 20), [cuentasConVariacion]);

  const lineasAGraficar = useMemo(() => {
    if (cuentasSeleccionadas.length > 0) return cuentasSeleccionadas;
    return cuentasConVariacion.slice(0, 8).map((f) => f.cuenta);
  }, [cuentasSeleccionadas, cuentasConVariacion]);

  const serieGrafica = useMemo(() => {
    const porFecha = {};
    datos.forEach((fila) => {
      if (!lineasAGraficar.includes(fila.cuenta)) return;
      if (!porFecha[fila.fecha]) porFecha[fila.fecha] = { fecha: fila.fecha };
      porFecha[fila.fecha][fila.cuenta] = (porFecha[fila.fecha][fila.cuenta] || 0) + fila[metrica];
    });
    return Object.values(porFecha).sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
  }, [datos, lineasAGraficar, metrica]);

  const coloresLineas = ['#2a78d6', '#eda100', '#008300', '#e34948', '#4a3aa7', '#e87ba4', '#1baf7a', '#eb6834'];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ background: 'var(--imss-verde-oscuro)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--imss-verde-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, color: 'var(--imss-verde-oscuro)', flexShrink: 0 }}>
          IMSS
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--imss-verde-claro)' }}>Hospital General de Zona No. 02</p>
          <p style={{ margin: 0, fontSize: 12, color: '#C0DD97' }}>Departamento de Finanzas · Oficina de Presupuesto</p>
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--borde)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Métrica</label>
            <select value={metrica} onChange={(e) => setMetrica(e.target.value)}>
              {METRICAS.map((m) => (
                <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
              ))}
            </select>
          </div>
          <button onClick={buscarDatos} style={{ padding: '7px 16px', background: 'var(--imss-verde)', color: 'white', border: 'none', borderRadius: 4 }}>
            {cargando ? 'Cargando...' : 'Filtrar'}
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>
            Buscar cuenta ({cuentasSeleccionadas.length} seleccionada{cuentasSeleccionadas.length !== 1 ? 's' : ''} — vacío = cuentas con más movimiento)
          </label>
          <input
            type="text"
            placeholder="Número o nombre de cuenta..."
            value={busquedaCuenta}
            onChange={(e) => setBusquedaCuenta(e.target.value)}
            style={{ width: '100%', maxWidth: 400 }}
          />

          {cuentasSeleccionadas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
              {cuentasSeleccionadas.map((cuenta) => (
                <span
                  key={cuenta}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--imss-verde-claro)', color: 'var(--imss-verde-oscuro)',
                    padding: '4px 8px', borderRadius: 4, fontSize: 12,
                  }}
                >
                  {cuenta} — {catalogoPorCuenta[cuenta]?.descripcion || ''}
                  <span
                    onClick={() => alternarCuenta(cuenta)}
                    style={{ cursor: 'pointer', fontWeight: 700, paddingLeft: 2 }}
                    title="Quitar"
                  >
                    ×
                  </span>
                </span>
              ))}
              <button
                onClick={() => setCuentasSeleccionadas([])}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                Ver todas (quitar selección)
              </button>
            </div>
          )}

          {busquedaCuenta && (
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--borde)', borderRadius: 4, marginTop: 6, background: 'white' }}>
              {cuentasFiltradas.slice(0, 30).map((c) => (
                <div
                  key={c.cuenta}
                  onClick={() => alternarCuenta(c.cuenta)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 13,
                    cursor: 'pointer',
                    background: cuentasSeleccionadas.includes(c.cuenta) ? 'var(--imss-verde-claro)' : 'white',
                    borderBottom: '1px solid #f0f0ee',
                  }}
                >
                  {c.cuenta} — {c.descripcion}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: '#A32D2D', fontSize: 13 }}>{error}</p>}

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto-secundario)', margin: '0 0 8px' }}>
          {METRICAS.find((m) => m.valor === metrica)?.etiqueta} — {desde} a {hasta}
        </p>
        <div style={{ height: 280, marginBottom: '2rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serieGrafica}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1e6).toFixed(1) + 'M'} />
              <Tooltip formatter={(v) => formatoMoneda(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => `${value} — ${catalogoPorCuenta[value]?.descripcion || ''}`} />
              {lineasAGraficar.map((linea, i) => (
                <Line
                  key={linea}
                  type="monotone"
                  dataKey={linea}
                  name={`${linea} — ${catalogoPorCuenta[linea]?.descripcion || ''}`}
                  stroke={coloresLineas[i % coloresLineas.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto-secundario)', margin: '0 0 8px' }}>
          Cuentas con mayor variación en el rango (top 20)
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--borde)' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Cuenta</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>{desde}</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>{hasta}</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Variación</th>
            </tr>
          </thead>
          <tbody>
            {tablaResumen.map((fila) => (
              <tr key={fila.cuenta} style={{ borderBottom: '1px solid #f0f0ee' }}>
                <td style={{ padding: '8px 4px' }}>{fila.cuenta} — {fila.descripcion}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(fila.inicio)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(fila.fin)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', color: fila.variacion < 0 ? '#A32D2D' : fila.variacion > 0 ? '#27500A' : 'inherit' }}>
                  {formatoMoneda(fila.variacion)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
