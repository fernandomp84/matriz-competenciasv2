import axios from 'axios'

export interface ProcessingError {
  hoja: string
  fila: number
  error: string
}

export interface MatrixError {
  idCursoSiga: string
  campo: string
  error: string
}

export interface MegamatrizStats {
  procesados: number
  totalErrores: number
  t1Errores: number
  t3Errores: number
  t5Errores: number
  totalFilasT1: number
  tmEntradas: number
  elapsedMs: number
}

export interface MegamatrizAudit {
  usuario: string
  equipo: string
  fecha: string
  archivoFuente: string
}

export interface MegamatrizResult {
  resultado: { status: boolean; data: Record<string, unknown>; tm: Record<string, string> }
  errores: ProcessingError[]
  stats: MegamatrizStats
  audit: MegamatrizAudit
}

export interface MatrixRow {
  'Número ID paterno': string
  'Número ID': string
  Nombre_corto: string
  Descripción: string
  'Formato de descripción': number
}

export interface MatrixStats {
  totalFilas: number
  programas: number
  totalErrores: number
  tmEntradas: number
}

export interface MatrixResult {
  filas: MatrixRow[]
  errores: MatrixError[]
  csvContent: string
  erroresXlsxB64: string
  stats: MatrixStats
}

export interface EquivStatus {
  configured: boolean
  message: string
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://matriz-competenciasv2.onrender.com/api',
  timeout: 180_000,
})

// ── Config ─────────────────────────────────────────────────────────────────────

export async function checkEquivStatus(): Promise<EquivStatus> {
  const { data } = await client.get<EquivStatus>('/config/equivalencias/status')
  return data
}

export async function updateEquivalencias(file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  await client.put('/config/equivalencias', form)
}

// ── Processing ─────────────────────────────────────────────────────────────────

export interface TMPreview {
  hojas: string[]
  tmEncontrada: boolean
  tmEntradas: Record<string, string>
  total: number
}

export async function previewTM(mainFile: File): Promise<TMPreview> {
  const form = new FormData()
  form.append('main_file', mainFile)
  const { data } = await client.post<TMPreview>('/process/preview-tm', form)
  return data
}

export async function processMegamatriz(mainFile: File): Promise<MegamatrizResult> {
  const form = new FormData()
  form.append('main_file', mainFile)
  const { data } = await client.post<MegamatrizResult>('/process/megamatriz', form)
  return data
}

export async function processMatrixFromData(jsonData: object): Promise<MatrixResult> {
  const blob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' })
  const file = new File([blob], 'salida.json', { type: 'application/json' })
  const form = new FormData()
  form.append('json_file', file)
  const { data } = await client.post<MatrixResult>('/process/matrix', form)
  return data
}

// ── Downloads ──────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadJSON(data: object, filename = 'salida.json') {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename,
  )
}

export function downloadCSV(content: string, filename = 'Matriz_Competencias.csv') {
  triggerDownload(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' }), filename)
}

export function downloadErrorsCSV(errors: ProcessingError[], filename = 'errores.csv') {
  const header = 'hoja,fila,error\n'
  const rows = errors
    .map((e) => `"${e.hoja}","${e.fila}","${e.error.replace(/"/g, '""')}"`)
    .join('\n')
  triggerDownload(
    new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' }),
    filename,
  )
}

export function downloadBase64File(b64: string, filename: string, mimeType: string) {
  const bytes = atob(b64)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i)
  triggerDownload(new Blob([buffer], { type: mimeType }), filename)
}
