'use client';

import { useState, useEffect, useMemo } from 'react';

function formatoMoneda(v) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v || 0);
}

function colorAvance(pct) {
  if (pct === null) return 'var(--texto-secundario)';
  if (pct > 100) return '#A32D2D';
  if (pct >= 80) return '#27500A';
  if (pct >= 50) return '#8a6d1a';
  return '#5f5e5a';
}

export default function AvancePresupuestal() {
  const [cuentas, setCuentas] = useState([]);
  const [fechaCorte, setFechaCorte] = useState('');
  const [datosDia, setDatosDia] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [capituloSel, setCapituloSel] = useState('');
  const [tipoSel, setTipoSel] = useState('');
  const [cuentaSel, setCuentaSel] = useState('');

  useEffect(() => {
    fetch('/api/cuentas')
      .then((r) => r.json())
      .then(setCuentas)
      .catch((e) => setError('No se pudo cargar el catálogo: ' + e.message));
  }, []);

  function buscar(fechaParam) {
    const f = fechaParam || fechaCorte;
    setCargando(true);
    setError(null);
    fetch(`/api/datos?desde=${f}&hasta=${f}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setDatosDia(d);
      })
      .catch((e) => setError('No se pudieron cargar los datos: ' + e.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    fetch('/api/ultima-fecha')
      .then((r) => r.json())
      .then((d) => {
        const ultima = d.fecha || new Date().toISOString().slice(0, 10);
        setFechaCorte(ultima);
        buscar(ultima);
      })
      .catch((e) => setError('No se pudo determinar la última fecha disponible: ' + e.message));
    // eslint-disable-next-line
  }, []);

  const catalogoPorCuenta = useMemo(() => {
    const m = {};
    cuentas.forEach((c) => (m[c.cuenta] = c));
    return m;
  }, [cuentas]);

  const datosPorCuenta = useMemo(() => {
    const m = {};
    datosDia.forEach((f) => (m[f.cuenta] = f));
    return m;
  }, [datosDia]);

  const capitulosDisponibles = useMemo(
    () => Array.from(new Set(cuentas.map((c) => c.capitulo).filter(Boolean))).sort(),
    [cuentas]
  );

  const tiposDisponibles = useMemo(() => {
    const base = capituloSel ? cuentas.filter((c) => c.capitulo === capituloSel) : cuentas;
    return Array.from(new Set(base.map((c) => c.tipo).filter(Boolean))).sort();
  }, [cuentas, capituloSel]);

  const cuentasDisponibles = useMemo(() => {
    let base = cuentas;
    if (capituloSel) base = base.filter((c) => c.capitulo === capituloSel);
    if (tipoSel) base = base.filter((c) => c.tipo === tipoSel);
    return base.slice().sort((a, b) => a.cuenta.localeCompare(b.cuenta));
  }, [cuentas, capituloSel, tipoSel]);

  function sumar(lista) {
    let presupuesto = 0, gasto = 0, comprometido = 0, precomprometido = 0, disponible = 0;
    lista.forEach((cuenta) => {
      const d = datosPorCuenta[cuenta];
      if (!d) return;
      presupuesto += d.presupuesto;
      gasto += d.gasto;
      comprometido += d.comprometido;
      precomprometido += d.precomprometido;
      disponible += d.disponible;
    });
    return {
      presupuesto, gasto, comprometido, precomprometido, disponible,
      avance: presupuesto !== 0 ? (gasto / presupuesto) * 100 : null,
    };
  }

  const filas = useMemo(() => {
    if (cuentaSel) {
      const s = sumar([cuentaSel]);
      return [{ nombre: `${cuentaSel} — ${catalogoPorCuenta[cuentaSel]?.descripcion || ''}`, ...s }];
    }
    if (tipoSel) {
      return cuentasDisponibles.map((c) => ({
        nombre: `${c.cuenta} — ${c.descripcion}`,
        ...sumar([c.cuenta]),
      }));
    }
    if (capituloSel) {
      const tipos = Array.from(new Set(cuentas.filter((c) => c.capitulo === capituloSel).map((c) => c.tipo)));
      return tipos.sort().map((tipo) => {
        const cuentasDelTipo = cuentas.filter((c) => c.capitulo === capituloSel && c.tipo === tipo).map((c) => c.cuenta);
        return { nombre: tipo, ...sumar(cuentasDelTipo) };
      });
    }
    return capitulosDisponibles.map((cap) => {
      const cuentasDelCap = cuentas.filter((c) => c.capitulo === cap).map((c) => c.cuenta);
      return { nombre: `Capítulo ${cap}`, ...sumar(cuentasDelCap) };
    });
  }, [cuentaSel, tipoSel, capituloSel, cuentasDisponibles, cuentas, capitulosDisponibles, datosPorCuenta, catalogoPorCuenta]);

  const totalGeneral = useMemo(() => {
    const universo = cuentaSel ? [cuentaSel] : cuentasDisponibles.map((c) => c.cuenta);
    return sumar(universo);
  }, [cuentaSel, cuentasDisponibles, datosPorCuenta]);

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
        <a href="/" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--imss-verde-claro)', textDecoration: 'underline' }}>
          ← Volver al panel
        </a>
      </div>

      <div style={{ padding: '1.5rem' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--imss-verde-oscuro)', margin: '0 0 1rem' }}>
          Avance Presupuestal
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--borde)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Corte al</label>
            <input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} />
          </div>
         <button onClick={() => buscar()} style={{ padding: '7px 16px', background: 'var(--imss-verde)', color: 'white', border: 'none', borderRadius: 4 }}>
            {cargando ? 'Cargando...' : 'Consultar'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Capítulo</label>
            <select
              value={capituloSel}
              onChange={(e) => { setCapituloSel(e.target.value); setTipoSel(''); setCuentaSel(''); }}
            >
              <option value="">Todos</option>
              {capitulosDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Tipo</label>
            <select
              value={tipoSel}
              onChange={(e) => { setTipoSel(e.target.value); setCuentaSel(''); }}
            >
              <option value="">Todos</option>
              {tiposDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--texto-secundario)', marginBottom: 4 }}>Cuenta</label>
            <select value={cuentaSel} onChange={(e) => setCuentaSel(e.target.value)}>
              <option value="">Todas ({cuentasDisponibles.length})</option>
              {cuentasDisponibles.map((c) => (
                <option key={c.cuenta} value={c.cuenta}>{c.cuenta} — {c.descripcion}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p style={{ color: '#A32D2D', fontSize: 13 }}>{error}</p>}

        <div style={{ background: '#f0f0ee', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', display: 'inline-block' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--texto-secundario)' }}>% Avance Anual (Gasto ÷ Presupuesto)</p>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: colorAvance(totalGeneral.avance) }}>
            {totalGeneral.avance === null ? 'N/A' : `${totalGeneral.avance.toFixed(1)}%`}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--texto-secundario)' }}>
            Gasto: {formatoMoneda(totalGeneral.gasto)} de {formatoMoneda(totalGeneral.presupuesto)}
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--borde)' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>
                {cuentaSel ? 'Cuenta' : tipoSel ? 'Cuenta' : capituloSel ? 'Tipo' : 'Capítulo'}
              </th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Presupuesto</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Gasto</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Comprometido</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Precomprometido</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>Disponible</th>
              <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--texto-secundario)', fontWeight: 500 }}>% Avance</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid #f0f0ee',
                  cursor: !cuentaSel && !tipoSel ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (cuentaSel) return;
                  if (tipoSel) { setCuentaSel(f.nombre.split(' — ')[0]); return; }
                  if (capituloSel) { setTipoSel(f.nombre); return; }
                  setCapituloSel(f.nombre.replace('Capítulo ', ''));
                }}
              >
                <td style={{ padding: '8px 4px' }}>{f.nombre}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.presupuesto)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.gasto)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.comprometido)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.precomprometido)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(f.disponible)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: colorAvance(f.avance) }}>
                  {f.avance === null ? 'N/A' : `${f.avance.toFixed(1)}%`}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--borde)', fontWeight: 700 }}>
              <td style={{ padding: '8px 4px' }}>Total</td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(totalGeneral.presupuesto)}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(totalGeneral.gasto)}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(totalGeneral.comprometido)}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(totalGeneral.precomprometido)}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatoMoneda(totalGeneral.disponible)}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', color: colorAvance(totalGeneral.avance) }}>
                {totalGeneral.avance === null ? 'N/A' : `${totalGeneral.avance.toFixed(1)}%`}
              </td>
            </tr>
          </tbody>
        </table>

        {!cuentaSel && (
          <p style={{ fontSize: 11, color: 'var(--texto-secundario)', marginTop: 10 }}>
            Clic en una fila para bajar de nivel {capituloSel ? '(Tipo → Cuenta)' : '(Capítulo → Tipo)'}.
          </p>
        )}
      </div>
    </div>
  );
}
