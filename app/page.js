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

  const detalleDiaADia = useMemo(() => {
    if (cuentasSeleccionadas.length !== 1) return [];
    const cuenta = cuentasSeleccionadas[0];
    const filas = datos
      .filter((f) => f.cuenta === cuenta)
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
  }, [datos, cuentasSeleccionadas, metrica]);

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
        <div style={{
