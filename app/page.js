'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metrica, setMetrica] = useState('disponible');
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [filtroSigno, setFiltroSigno] = useState('todos');
  const [tipoDrill, setTipoDrill] = useState(null);
  const [cuentaDrill, setCuentaDrill] = useState(null);
  const [comentariosDia, setComentariosDia] = useState({});
  const [editandoFecha, setEditandoFecha] = useState(null);
  const [textoTemp, setTextoTemp] = useState('');

  useEffect(() => {
    fetch('/api/cuentas')
      .then((r) => r.json())
      .then(setCuentas)
      .catch((e) => setError('No se pudo cargar el catálogo de cuentas: ' + e.message));
  }, []);

  function buscarDatos(desdeParam, hastaParam) {
    const d = desdeParam || desde;
    const h = hastaParam || hasta;
    setCargando(true);
    setError(null);
    const params = new URLSearchParams({ desde: d, hasta: h });
    fetch('/api/datos?' + params.toString())
      .then((r) => r.json())
      .then((datos) => {
        if (datos.error) throw new Error(datos.error);
        setDatos(datos);
      })
      .catch((e) => setError('No se pudieron cargar los datos: ' + e.message))
      .finally(() => setCargando(false));
  }

  function guardarComentarioDia(fecha, texto) {
    setComentariosDia((prev) => ({ ...prev, [fecha]: texto }));
    setEditandoFecha(null);
    fetch('/api/comentarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuenta: cuentaDrill, metrica, fecha, comentario: texto }),
    }).catch((e) => setError('No se pudo guardar el comentario: ' + e.message));
  }

  useEffect(() => {
    if (!cuentaDrill) { setComentariosDia({}); return; }
    fetch(`/api/comentarios?cuenta=${cuentaDrill}&metrica=${metrica}`)
      .then((r) => r.json())
      .then((lista) => {
        if (lista.error) return;
        const mapa = {};
        lista.forEach((c) => { mapa[c.fecha] = c.comentario; });
        setComentariosDia(mapa);
      })
      .catch(() => {});
  }, [cuentaDrill, metrica]);

  useEffect(() => {
    fetch('/api/ultima-fecha')
      .then((r) => r.json())
      .then((d) => {
        const ultima = d.fecha || new Date().toISOString().slice(0, 10);
        const dt = new Date(ultima + 'T00:00:00');
        const primerDiaMes = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString().slice(0, 10);
        setDesde(primerDiaMes);
        setHasta(ultima);
        buscarDatos(primerDiaMes, ultima);
      })
      .catch((e) => setError('No se pudo determinar la última fecha disponible: ' + e.message));
    // eslint-disable-next-line
  }, []);

  const catalogoPorCuenta = useMemo(() => {
    const m = {};
    cuentas.forEach((c) => (m[c.cuenta] = c));
    return m;
  }, [cuentas]);

  const fechasOrdenadas = useMemo(() => {
    const set = new Set(datos.map((f) => f.fecha));
    return Array.from(set).sort();
  }, [datos]);

  const totalMensual = useMemo(() => {
    const ultimoPorCuentaMes = {};
    datos.forEach((fila) => {
      const mes = fila.fecha.slice(0, 7);
      if (!ultimoPorCuentaMes[mes]) ultimoPorCuentaMes[mes] = {};
      const actual = ultimoPorCuentaMes[mes][fila.cuenta];
      if (!actual || fila.fecha > actual.fecha) {
        ultimoPorCuentaMes[mes][fila.cuenta] = { fecha: fila.fecha, valor: fila[metrica] };
      }
    });
    return Object.keys(ultimoPorCuentaMes).sort().map((mes) => ({
      mes,
      total: Object.values(ultimoPorCuentaMes[mes]).reduce((s, x) => s + x.valor, 0),
    }));
  }, [datos, metrica]);

  const variacionMensual = useMemo(() => {
    const res = [];
    for (let i = 1; i < totalMensual.length; i++) {
      const prev = totalMensual[i - 1].total;
      const act = totalMensual[i].total;
      res.push({
        mesDe: totalMensual[i - 1].mes,
        mesA: totalMensual[i].mes,
        variacion: act - prev,
        pct: prev ? ((act - prev) / prev) * 100 : null,
      });
    }
    return res;
  }, [totalMensual]);

  const cuentasConVariacion = useMemo(() => {
    const primeraFecha = fechasOrdenadas[0];
    const ultimaFecha = fechasOrdenadas[fechasOrdenadas.length - 1];
    const porCuenta = {};
    datos.forEach((fila) => {
      if (!porCuenta[fila.cuenta]) porCuenta[fila.cuenta] = {};
      if (fila.fecha === primeraFecha) porCuenta[fila.cuenta].inicio = fila[metrica];
      if (fila.fecha === ultimaFecha) porCuenta[fila.cuenta].fin = fila[metrica];
    });
    return Object.entries(porCuenta).map(([cuenta, v]) => ({
      cuenta,
      descripcion: catalogoPorCuenta[cuenta]?.descripcion || 'Sin descripción',
      tipo: catalogoPorCuenta[cuenta]?.tipo || null,
      inicio: v.inicio || 0,
      fin: v.fin ?? v.inicio ?? 0,
      variacion: (v.fin ?? v.inicio ?? 0) - (v.inicio || 0),
    }));
  }, [datos, fechasOrdenadas, metrica, catalogoPorCuenta]);

  const poblacionActiva = useMemo(() => {
    if (tipoDrill) return cuentasConVariacion.filter((f) => f.tipo === tipoDrill);
    return cuentasConVariacion.filter((f) => f.tipo);
  }, [cuentasConVariacion, tipoDrill]);

  const filasNivel = useMemo(() => {
    if (tipoDrill) {
      return poblacionActiva
        .filter((f) => f.variacion !== 0)
        .map((f) => ({ clave: f.cuenta, nombre: `${f.cuenta} — ${f.descripcion}`, ...f }))
        .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
    }
    const porTipo = {};
    poblacionActiva.forEach((f) => {
      if (!porTipo[f.tipo]) porTipo[f.tipo] = { inicio: 0, fin: 0, variacion: 0 };
      porTipo[f.tipo].inicio += f.inicio;
      porTipo[f.tipo].fin += f.fin;
      porTipo[f.tipo].variacion += f.variacion;
    });
    return Object.entries(porTipo)
      .filter(([, v]) => v.variacion !== 0)
      .map(([tipo, v]) => ({ clave: tipo, nombre: tipo, ...v }))
      .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
  }, [poblacionActiva, tipoDrill]);

  const filasNivelPorSigno = useMemo(() => {
    if (filtroSigno === 'incremento') return filasNivel.filter((f) => f.variacion > 0);
    if (filtroSigno === 'decremento') return filasNivel.filter((f) => f.variacion < 0);
    return filasNivel;
  }, [filasNivel, filtroSigno]);

  const kpis = useMemo(() => {
    const incrementos = filasNivel.filter((f) => f.variacion > 0);
    const decrementos = filasNivel.filter((f) => f.variacion < 0);
    const sumaIncrementos = incrementos.reduce((s, f) => s + f.variacion, 0);
    const sumaDecrementos = decrementos.reduce((s, f) => s + f.variacion, 0);
    return {
      total: filasNivel.length,
      incrementos: { count: incrementos.length, suma: sumaIncrementos },
      decrementos: { count: decrementos.length, suma: sumaDecrementos },
      neto: sumaIncrementos + sumaDecrementos,
    };
  }, [filasNivel]);

  const datosBarras = useMemo(() => filasNivelPorSigno.slice(0, 10), [filasNivelPorSigno]);

  const detalleDiaADia = useMemo(() => {
    if (!cuentaDrill) return [];
    const filas = datos
      .filter((f) => f.cuenta === cuentaDrill)
      .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
    const resultado = [];
    for (let i = 1; i < filas.length; i++) {
      const anterior = filas[i - 1][metrica];
      const actual = filas[i][metrica];
      resultado.push({
        fechaAnterior: filas[i - 1].fecha,
        fechaActual: filas[i].fecha,
        anterior,
        actual,
        variacion: actual - anterior,
      });
    }
    return resultado.reverse();
  }, [datos, cuentaDrill, metrica]);

  function clicFila(clave) {
    if (!tipoDrill) {
      setTipoDrill(clave);
    } else {
      setCuentaDrill(clave);
    }
  }

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
        <a href="/avance" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--imss-verde-claro)', textDecoration: 'underline' }}>
          Avance Presupuestal
        </a>
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
          <button onClick={() => buscarDatos()} style={{ padding: '7px 16px', background: 'var(--imss-verde)', color: 'white', border: 'none', borderRadius: 4 }}>
            {cargando ? 'Cargando...' : 'Filtrar'}
          </button>
        </div>

        {error && <p style={{ color: '#A32D2D', fontSize: 13 }}>{error}</p>}

        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--imss-verde-oscuro)', margin: '0 0 8px' }}>
          {METRICAS.find((m) => m.valor === metrica)?.etiqueta} total mensual — {desde} a {hasta}
        </p>
        <div style={{ height: 260, marginBottom: '0.75rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totalMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1e6).toFixed(1) + 'M'} />
              <Tooltip formatter={(v) => formatoMoneda(v)} />
              <Bar dataKey="total" fill="var(--imss-verde)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {variacionMensual.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '2rem' }}>
            {variacionMensual.map((v, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 12,
                  background: v.variacion < 0 ? '#FAECE7' : '#eaf3de',
                  color: v.variacion < 0 ? '#712B13' : 'var(--imss-verde-oscuro)',
                }}
              >
                {v.mesDe} → {v.mesA}: {v.variacion >= 0 ? '+' : ''}{formatoMoneda(v.variacion)}
                {v.pct !== null && ` (${v.pct >= 0 ? '+' : ''}${v.pct.toFixed(1)}%)`}
              </span>
            ))}
          </div>
        )}

        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--imss-verde-oscuro)', margin: '0 0 4px' }}>
          Variación por {tipoDrill ? 'cuenta' : 'tipo'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--texto-secundario)', margin: '0 0 12px' }}>
          {tipoDrill ? (
            <>
              Tipo: <strong>{tipoDrill}</strong> —{' '}
              <span onClick={() => { setTipoDrill(null); setCuentaDrill(null); }} style={{ color: 'var(--imss-verde)', cursor: 'pointer', textDecoration: 'underline' }}>
                quitar filtro
              </span>
            </>
          ) : (
            'Clic en una barra o fila para ver el detalle por cuenta.'
          )}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: '0.5rem' }}>
          <div
            onClick={() => setFiltroSigno(filtroSigno === 'incremento' ? 'todos' : 'incremento')}
            style={{
              background: 'var(--imss-verde-claro)', borderRadius: 8, padding: '1rem', cursor: 'pointer',
              border: filtroSigno === 'incremento' ? '2px solid var(--imss-verde)' : '2px solid transparent',
            }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--imss-verde-oscuro)' }}>Con incremento</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--imss-verde-oscuro)' }}>{kpis.incrementos.count}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--imss-verde-oscuro)' }}>{formatoMoneda(kpis.incrementos.suma)}</p>
          </div>
          <div
            onClick={() => setFiltroSigno(filtroSigno === 'decremento' ? 'todos' : 'decremento')}
            style={{
              background: '#FAECE7', borderRadius: 8, padding: '1rem', cursor: 'pointer',
              border: filtroSigno === 'decremento' ? '2px solid #D85A30' : '2px solid transparent',
            }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#712B13' }}>Con decremento</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#712B13' }}>{kpis.decrementos.count}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#712B13' }}>{formatoMoneda(kpis.decrementos.suma)}</p>
          </div>
          <div style={{ background: '#f0f0ee', borderRadius: 8, padding: '1rem' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--texto-secundario)' }}>Con movimiento</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{kpis.total}</p>
          </div>
          <div style={{ background: '#f0f0ee', borderRadius: 8, padding: '1rem' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--texto-secundario)' }}>Variación neta</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: kpis.neto < 0 ? '#A32D2D' : kpis.neto > 0 ? '#27500A' : 'inherit' }}>
              {formatoMoneda(kpis.neto)}
            </p>
          </div>
        </div>

        {filtroSigno !== 'todos' && (
          <p style={{ fontSize: 12, color: 'var(--texto-secundario)', margin: '0.75rem 0 1.5rem' }}>
            Filtrando por: {filtroSigno === 'incremento' ? 'incremento' : 'decremento'} —{' '}
            <span onClick={() => setFiltroSigno('todos')} style={{ color: 'var(--imss-verde)', cursor: 'pointer', textDecoration: 'underline' }}>
              quitar
            </span>
          </p>
        )}
        {filtroSigno === 'todos' && <div style={{ marginBottom: '2rem' }} />}

        <div style={{ height: Math.max(220, datosBarras.length * 32), marginBottom: '2rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datosBarras} layout="vertical" margin={{ left: 10, right: 20 }} onClick={(e) => { if (e?.activePayload?.[0]) clicFila(e.activePayload[0].payload.clave); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1e6).toFixed(1) + 'M'} />
              <YAxis type="category" dataKey="clave" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => formatoMoneda(v)} labelFormatter={(label) => label} />
              <Bar dataKey="variacion" radius={[0, 4, 4, 0]} cursor="pointer">
                {datosBarras.map((d, i) => (
                  <Cell key={i} fill={d.variacion < 0 ? '#E24B4A' : '#639922'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--borde)' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>{tipoDrill ? 'Cuenta' : 'Tipo'}</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>{desde}</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>{hasta}</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Variación</th>
            </tr>
          </thead>
          <tbody>
            {filasNivelPorSigno.slice(0, 30).map((f) => (
              <tr key={f.clave} style={{ borderBottom: '1px solid #f0f0ee' }}>
                <td onClick={() => clicFila(f.clave)} style={{ padding: '8px 4px', cursor: 'pointer', color: 'var(--imss-verde)', textDecoration: 'underline' }}>
                  {f.nombre}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.inicio)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.fin)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', color: f.variacion < 0 ? '#A32D2D' : f.variacion > 0 ? '#27500A' : 'inherit' }}>
                  {formatoMoneda(f.variacion)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {cuentaDrill && detalleDiaADia.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto-secundario)', margin: '2rem 0 4px' }}>
              Detalle día a día — {catalogoPorCuenta[cuentaDrill]?.descripcion || cuentaDrill}
            </p>
            <p style={{ fontSize: 11, margin: '0 0 8px' }}>
              <span onClick={() => setCuentaDrill(null)} style={{ color: 'var(--imss-verde)', cursor: 'pointer', textDecoration: 'underline' }}>
                ← volver a la lista de cuentas
              </span>
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--borde)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>De</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>A</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Valor anterior</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Valor nuevo</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Variación</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {detalleDiaADia.map((fila, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0ee' }}>
                    <td style={{ padding: '8px 4px' }}>{fila.fechaAnterior}</td>
                    <td style={{ padding: '8px 4px' }}>{fila.fechaActual}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(fila.anterior)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(fila.actual)}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', color: fila.variacion < 0 ? '#A32D2D' : fila.variacion > 0 ? '#27500A' : 'inherit' }}>
                      {formatoMoneda(fila.variacion)}
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      {editandoFecha === fila.fechaActual ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="¿A qué se debe?"
                            value={textoTemp}
                            onChange={(e) => setTextoTemp(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') guardarComentarioDia(fila.fechaActual, textoTemp); }}
                            style={{ width: '100%', minWidth: 140, fontSize: 12, padding: '4px 6px' }}
                          />
                          <button
                            onClick={() => guardarComentarioDia(fila.fechaActual, textoTemp)}
                            style={{ fontSize: 11, padding: '4px 8px', background: 'var(--imss-verde)', color: 'white', border: 'none', borderRadius: 4, whiteSpace: 'nowrap' }}
                          >
                            Guardar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: comentariosDia[fila.fechaActual] ? 'inherit' : 'var(--texto-secundario)', fontStyle: comentariosDia[fila.fechaActual] ? 'normal' : 'italic' }}>
                            {comentariosDia[fila.fechaActual] || 'Sin comentario'}
                          </span>
                          <button
                            onClick={() => { setEditandoFecha(fila.fechaActual); setTextoTemp(comentariosDia[fila.fechaActual] || ''); }}
                            style={{ fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap' }}
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
