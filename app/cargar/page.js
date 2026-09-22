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
  const porCuentaPeriodo = {};
  const porCuentaCentro = {};

  for (const r of filasCrudo) {
    const cuenta = (r[0] || '').trim();
    const ui = (r[3] || '').trim();
    if (ui !== UI_OBJETIVO) continue;
    const centroCosto = (r[2] || '').trim();
    const periodo = (r[5] || '').trim();

    const vals = {
      presupuesto: limpiarNumero(r[6]),
      gasto: limpiarNumero(r[7]),
      comprometido: limpiarNumero(r[8]),
      precomprometido: limpiarNumero(r[9]),
      disponible: limpiarNumero(r[10]),
    };

    if (!porCuenta[cuenta]) porCuenta[cuenta] = { presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
    for (const k in vals) porCuenta[cuenta][k] += vals[k];

    const clavePeriodo = cuenta + '|' + periodo;
    if (!porCuentaPeriodo[clavePeriodo]) porCuentaPeriodo[clavePeriodo] = { cuenta, periodo, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
    for (const k in vals) porCuentaPeriodo[clavePeriodo][k] += vals[k];

    const claveCentro = cuenta + '|' + centroCosto;
    if (!porCuentaCentro[claveCentro]) porCuentaCentro[claveCentro] = { cuenta, centro_costo: centroCosto, presupuesto: 0, gasto: 0, comprometido: 0, precomprometido: 0, disponible: 0 };
    for (const k in vals) porCuentaCentro[claveCentro][k] += vals[k];
  }

  const filas = Object.entries(porCuenta).map(([cuenta, v]) => ({ cuenta, ...v }));
  const filasPeriodo = Object.values(porCuentaPeriodo);
  const filasCentro = Object.values(porCuentaCentro);
  if (filas.length === 0) throw new Error('No encontré filas con Uni.Información 10102 en este archivo.');

  return { fecha, filas, filasPeriodo, filasCentro };
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
      const { fecha, filas, filasPeriodo, filasCentro } = await procesarArchivo(archivo);

      const resp = await fetch('/api/cargar-dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, filas }),
      });
      const resultado = await resp.json();
      if (!resp.ok || resultado.error) {
        throw new Error(resultado.error || 'Error desconocido del servidor (nivel cuenta).');
      }

      const resp2 = await fetch('/api/cargar-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, filas: filasPeriodo }),
      });
      const resultado2 = await resp2.json();
      if (!resp2.ok || resultado2.error) {
