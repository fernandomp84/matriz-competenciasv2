import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Download, FileJson, Grid3X3, Layers,
  Loader2, RefreshCw, Settings, Shield, Upload, User, Eye,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import ErrorTable from '../components/ErrorTable'
import FileDropzone from '../components/FileDropzone'
import StatsCard from '../components/StatsCard'
import { useToast } from '../hooks/useToast'
import {
  checkEquivStatus, downloadBase64File, downloadCSV,
  downloadErrorsCSV, downloadJSON, previewTM, processMegamatriz,
  processMatrixFromData, updateEquivalencias,
  type EquivStatus, type MatrixResult, type MegamatrizResult, type TMPreview,
} from '../services/api'

type StepState = 'idle' | 'running' | 'done' | 'error'
interface Steps { mega: StepState; matrix: StepState }

function saveToHistory(type: string, filename: string, stats: Record<string, number>) {
  try {
    const raw = localStorage.getItem('processingHistory') ?? '[]'
    const history = JSON.parse(raw)
    history.push({ type, date: new Date().toISOString(), filename, stats })
    localStorage.setItem('processingHistory', JSON.stringify(history.slice(-30)))
  } catch {}
}

// ── Sección equivalencias ─────────────────────────────────────────────────────
function EquivSection({ status, onUpdated }: { status: EquivStatus; onUpdated: () => void }) {
  const [open, setOpen] = useState(!status.configured)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!file) return
    setSaving(true)
    try {
      await updateEquivalencias(file)
      toast('Equivalencias actualizadas correctamente', { type: 'success' })
      setFile(null)
      setOpen(false)
      onUpdated()
    } catch {
      toast('Error al actualizar equivalencias', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`card overflow-hidden ${!status.configured ? 'border-amber-200' : ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status.configured ? 'bg-brand-50' : 'bg-amber-50'}`}>
            <Settings className={`w-4 h-4 ${status.configured ? 'text-brand-700' : 'text-amber-600'}`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">Tabla de equivalencias</p>
            <p className="text-xs text-slate-400 mt-0.5">Departamentos y tipos de registro</p>
          </div>
          <div className="ml-2">
            {status.configured
              ? <span className="badge badge-success"><CheckCircle2 className="w-3 h-3" />Configurada</span>
              : <span className="badge badge-warning"><AlertCircle className="w-3 h-3" />Requerida</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 pt-1 space-y-4 border-t border-slate-100">
              {!status.configured && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  Sube el archivo <strong>Tabla de equivalencias.xlsx</strong> para activar el procesamiento.
                </div>
              )}
              <FileDropzone label="Tabla de equivalencias.xlsx" accept=".xlsx,.xls" file={file} onChange={setFile} hint="Mapeo de departamentos y tipos de registro" />
              {file && (
                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {saving ? 'Guardando…' : 'Guardar equivalencias'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Vista previa TM ───────────────────────────────────────────────────────────
function TMPreviewPanel({ preview, onConfirm, onReset }: {
  preview: TMPreview
  onConfirm: () => void
  onReset: () => void
}) {
  const entries = Object.entries(preview.tmEntradas)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <Eye className="w-4 h-4 text-brand-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Verificación de hoja TM</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Pestañas en el Excel: {preview.hojas.join(' · ')}
            </p>
          </div>
        </div>
        <button onClick={onReset} className="btn-ghost text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Cambiar archivo
        </button>
      </div>

      {/* Estado TM */}
      <div className="px-6 py-4 border-b border-slate-100 space-y-3">
        {preview.tmEncontrada ? (
          <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Hoja TM encontrada — {preview.total} padre{preview.total !== 1 ? 's' : ''} leído{preview.total !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Verifica que los datos de abajo sean correctos antes de procesar
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Hoja TM no encontrada en el archivo</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Se usará el nombre del programa (columna Programa de T1) como fallback.
              </p>
            </div>
          </div>
        )}
        {/* Regla especial SABE */}
        <div className="flex items-start gap-2.5 p-3 bg-brand-50 border border-brand-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
          <p className="text-xs text-brand-700">
            <strong>Regla SABE:</strong> Las metacompetencias con código <code className="bg-brand-100 px-1 rounded">SABE</code> usan el campo <strong>Source.Name</strong> de T2 como ID del padre principal (ej. <code className="bg-brand-100 px-1 rounded">SABER_UX</code>), no la hoja TM. Asegúrate de que ese código exista en la columna <strong>Matriz Principal</strong> de TM para que tome el nombre correcto.
          </p>
        </div>
      </div>

      {/* Tabla de padres */}
      {entries.length > 0 && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr style={{ backgroundColor: '#11225a' }}>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/80 uppercase tracking-wide w-40">
                  Matriz Principal (ID padre)
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/80 uppercase tracking-wide">
                  Descripción (Nombre_corto y Descripción en CSV)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(([codigo, desc]) => (
                <tr key={codigo} className="hover:bg-brand-50/40 transition-colors">
                  <td className="px-5 py-3 font-mono font-semibold text-brand-700 text-sm whitespace-nowrap">
                    {codigo}
                  </td>
                  <td className="px-5 py-3 text-slate-700 text-sm leading-snug">
                    {desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acciones */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
        <p className="text-xs text-slate-500">
          {entries.length > 0
            ? '¿Los nombres de los padres son correctos? Confirma para continuar.'
            : 'Puedes continuar sin TM — se usará el nombre del programa como fallback.'}
        </p>
        <button onClick={onConfirm} className="btn-primary">
          <CheckCircle2 className="w-4 h-4" />
          Confirmar y procesar
        </button>
      </div>
    </motion.div>
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ steps, megaStats, matrixStats }: {
  steps: Steps
  megaStats?: MegamatrizResult['stats']
  matrixStats?: MatrixResult['stats']
}) {
  const items = [
    {
      key: 'mega' as const, num: '1',
      label: 'Procesar Megamatriz',
      sub: megaStats
        ? `${megaStats.procesados} cursos · ${megaStats.totalErrores} errores · ${megaStats.elapsedMs.toFixed(0)} ms`
        : 'Leyendo hojas T1, T2, T3, T5 y construyendo JSON…',
    },
    {
      key: 'matrix' as const, num: '2',
      label: 'Generar Matriz de Competencias',
      sub: matrixStats
        ? `${matrixStats.totalFilas} filas · ${matrixStats.programas} programas · ${matrixStats.totalErrores} errores`
        : 'Construyendo jerarquía Programa → MetaCompetencia → RA → Indicador…',
    },
  ]
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="w-1 h-4 rounded-full bg-brand-700" />
        <h3 className="text-sm font-semibold text-brand-700">Progreso del procesamiento</h3>
      </div>
      {items.map(({ key, num, label, sub }, idx) => {
        const state = steps[key]
        return (
          <div key={key}>
            {idx > 0 && <div className="mx-6 border-t border-slate-100" />}
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="shrink-0">
                {state === 'running' ? (
                  <div className="w-9 h-9 rounded-full border-2 border-brand-200 bg-brand-50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-brand-700 animate-spin" />
                  </div>
                ) : state === 'done' ? (
                  <div className="w-9 h-9 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                ) : state === 'error' ? (
                  <div className="w-9 h-9 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-400">{num}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  state === 'done' ? 'text-emerald-700'
                  : state === 'running' ? 'text-brand-700'
                  : state === 'error' ? 'text-red-700'
                  : 'text-slate-400'}`}>{label}</p>
                {state !== 'idle' && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
              </div>
              {state === 'running' && <span className="text-xs font-semibold text-brand-600 animate-pulse shrink-0">En proceso…</span>}
              {state === 'done' && <span className="badge badge-success shrink-0">✓ Completado</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
type Phase = 'upload' | 'verifying' | 'preview' | 'processing' | 'done'

export default function Procesar() {
  const { toast } = useToast()

  const [phase, setPhase]               = useState<Phase>('upload')
  const [mainFile, setMainFile]         = useState<File | null>(null)
  const [equivStatus, setEquivStatus]   = useState<EquivStatus>({ configured: false, message: '' })
  const [tmPreview, setTmPreview]       = useState<TMPreview | null>(null)
  const [steps, setSteps]               = useState<Steps>({ mega: 'idle', matrix: 'idle' })
  const [megaResult, setMegaResult]     = useState<MegamatrizResult | null>(null)
  const [matrixResult, setMatrixResult] = useState<MatrixResult | null>(null)
  const [apiError, setApiError]         = useState<string | null>(null)

  useEffect(() => {
    checkEquivStatus().then(setEquivStatus).catch(() => {})
  }, [])

  // ── Fase 1: verificar TM ───────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!mainFile) return
    setPhase('verifying')
    setApiError(null)
    try {
      const preview = await previewTM(mainFile)
      setTmPreview(preview)
      setPhase('preview')
      if (!preview.tmEncontrada) {
        toast('Hoja TM no encontrada', { type: 'warning', message: 'Se usará el nombre del programa como fallback.' })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? (err as Error)?.message ?? 'Error desconocido'
      setApiError(msg)
      setPhase('upload')
      toast('Error al leer el archivo', { type: 'error', message: msg })
    }
  }

  // ── Fase 2: procesar ───────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!mainFile) return
    setApiError(null)
    setMegaResult(null)
    setMatrixResult(null)
    setPhase('processing')

    setSteps({ mega: 'running', matrix: 'idle' })
    try {
      const mega = await processMegamatriz(mainFile)
      setMegaResult(mega)
      setSteps({ mega: 'done', matrix: 'running' })
      saveToHistory('megamatriz', mainFile.name, mega.stats as unknown as Record<string, number>)

      const matrix = await processMatrixFromData(mega.resultado)
      setMatrixResult(matrix)
      setSteps({ mega: 'done', matrix: 'done' })
      setPhase('done')
      saveToHistory('matrix', 'salida.json', matrix.stats as unknown as Record<string, number>)

      toast('Procesamiento completado', {
        type: 'success',
        message: `${mega.stats.procesados} cursos · ${matrix.stats.totalFilas} filas en matriz`,
      })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? (err as Error)?.message ?? 'Error desconocido'
      const failedStep: keyof Steps = steps.mega === 'running' ? 'mega' : 'matrix'
      setSteps((s) => ({ ...s, [failedStep]: 'error' }))
      setApiError(msg)
      toast('Error al procesar', { type: 'error', message: msg })
    }
  }

  const handleReset = () => {
    setMainFile(null); setPhase('upload'); setTmPreview(null)
    setSteps({ mega: 'idle', matrix: 'idle' })
    setMegaResult(null); setMatrixResult(null); setApiError(null)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <h1 className="page-title">Procesar Megamatriz</h1>
        <div className="title-underline" />
        <p className="page-subtitle -mt-4">
          Sube el archivo Excel, verifica los datos de la hoja TM y genera automáticamente el JSON y la Matriz de Competencias.
        </p>
      </div>

      {/* Equivalencias */}
      <div className="mb-5">
        <EquivSection status={equivStatus} onUpdated={() => checkEquivStatus().then(setEquivStatus).catch(() => {})} />
      </div>

      {/* ── FASE: Subir archivo ─────────────────────────────────────────────── */}
      {(phase === 'upload' || phase === 'verifying') && (
        <div className="card mb-5">
          <div className="card-header">
            <div className="w-1 h-4 rounded-full bg-brand-700" />
            <h2 className="text-sm font-semibold text-brand-700">Archivo de entrada</h2>
          </div>
          <div className="card-body space-y-4">
            <FileDropzone
              label="Seleccionar Megamatriz Electivas.xlsx"
              accept=".xlsx,.xls"
              file={mainFile}
              onChange={(f) => { setMainFile(f); setTmPreview(null) }}
              hint="Excel con hojas T1, T2, T3, T5 y TM"
              disabled={phase === 'verifying'}
            />

            {!equivStatus.configured && (
              <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-800">Configura primero la tabla de equivalencias.</p>
              </div>
            )}

            {apiError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-600 mt-0.5">{apiError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-2">
              <p className="text-xs text-slate-400">
                {!equivStatus.configured ? 'Configura las equivalencias primero'
                  : !mainFile ? 'Selecciona el archivo Excel'
                  : 'Primero se verificará la hoja TM antes de procesar'}
              </p>
              <button
                onClick={handleVerify}
                disabled={!mainFile || !equivStatus.configured || phase === 'verifying'}
                className="btn-primary"
              >
                {phase === 'verifying'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Leyendo TM…</>
                  : <><Eye className="w-4 h-4" />Verificar hoja TM</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FASE: Preview TM ────────────────────────────────────────────────── */}
      {phase === 'preview' && tmPreview && (
        <div className="mb-5">
          <TMPreviewPanel
            preview={tmPreview}
            onConfirm={handleProcess}
            onReset={handleReset}
          />
        </div>
      )}

      {/* ── FASE: Procesando ────────────────────────────────────────────────── */}
      {phase === 'processing' && (
        <div className="mb-5">
          <StepIndicator steps={steps} megaStats={megaResult?.stats} matrixStats={matrixResult?.stats} />
        </div>
      )}

      {/* ── FASE: Resultados ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'done' && megaResult && matrixResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }} className="space-y-5"
          >
            {/* Step indicator completado */}
            <StepIndicator steps={steps} megaStats={megaResult.stats} matrixStats={matrixResult.stats} />

            {/* Banner éxito */}
            <div className="flex items-center justify-between p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Ambos pasos completados exitosamente</p>
              </div>
              <button onClick={handleReset} className="btn-ghost text-emerald-700 hover:bg-emerald-100 text-sm">
                <RefreshCw className="w-3.5 h-3.5" />Nuevo archivo
              </button>
            </div>

            {/* Auditoría */}
            <div className="card p-4 flex flex-wrap gap-x-5 gap-y-2">
              {[
                { icon: User, val: megaResult.audit.usuario },
                { icon: Clock, val: megaResult.audit.fecha },
                { icon: FileJson, val: megaResult.audit.archivoFuente, mono: true },
              ].map(({ icon: Icon, val, mono }, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
                  <Icon className="w-3.5 h-3.5 text-brand-400" />
                  <span className={mono ? 'font-mono text-xs' : ''}>{val}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatsCard icon={FileJson}    label="Cursos procesados"  value={megaResult.stats.procesados} color="navy" />
              <StatsCard icon={AlertCircle} label="Errores Megamatriz" value={megaResult.stats.totalErrores} color={megaResult.stats.totalErrores > 0 ? 'red' : 'emerald'} />
              <StatsCard icon={Grid3X3}     label="Filas en matriz"    value={matrixResult.stats.totalFilas} color="emerald" />
              <StatsCard icon={Shield}      label="Programas raíz"     value={matrixResult.stats.programas} color="slate" />
              <StatsCard
                icon={Layers}
                label="Padres desde TM"
                value={megaResult.stats.tmEntradas ?? 0}
                sub={megaResult.stats.tmEntradas ? 'Nombres leídos de hoja TM' : 'Sin hoja TM'}
                color={megaResult.stats.tmEntradas ? 'navy' : 'amber'}
              />
            </div>

            {/* Errores */}
            <ErrorTable errors={megaResult.errores}   title={`Errores de Megamatriz (${megaResult.errores.length})`} />
            <ErrorTable errors={matrixResult.errores} title={`Errores de Matriz (${matrixResult.errores.length})`} />

            {/* Vista previa */}
            {matrixResult.filas.length > 0 && (
              <div className="card overflow-hidden">
                <div className="card-header">
                  <div className="w-1 h-4 rounded-full bg-brand-700" />
                  <h3 className="text-sm font-semibold text-brand-700">Vista previa — Matriz de Competencias</h3>
                  <span className="ml-auto text-xs text-slate-400">Primeras 8 filas</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: '#11225a' }}>
                        {['ID Paterno', 'ID Nodo', 'Nombre corto'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 font-semibold text-white/80 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matrixResult.filas.slice(0, 8).map((row, i) => (
                        <tr key={i} className="hover:bg-brand-50/40 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-400 max-w-[120px] truncate">{row['Número ID paterno'] || '—'}</td>
                          <td className="px-5 py-3 font-mono font-semibold text-brand-700 max-w-[180px] truncate">{row['Número ID']}</td>
                          <td className="px-5 py-3 text-slate-600 max-w-[280px] truncate">{row['Nombre_corto']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {matrixResult.filas.length > 8 && (
                    <div className="px-5 py-3 text-center text-xs text-slate-400 border-t border-slate-100 bg-slate-50">
                      +{matrixResult.filas.length - 8} filas adicionales en el CSV
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Descargas */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-4 rounded-full bg-brand-700" />
                <h3 className="text-sm font-semibold text-brand-700">Archivos generados</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => { downloadCSV(matrixResult.csvContent, 'Matriz_Competencias.csv'); toast('CSV descargado', { type: 'success' }) }} className="btn-primary justify-start gap-3 py-3.5">
                  <Download className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-bold">Matriz_Competencias.csv</p>
                    <p className="text-xs opacity-75 font-normal mt-0.5">{matrixResult.stats.totalFilas} filas jerárquicas</p>
                  </div>
                </button>
                <button onClick={() => { downloadJSON(megaResult.resultado, 'salida.json'); toast('JSON descargado', { type: 'success' }) }} className="btn-secondary justify-start gap-3 py-3.5">
                  <Download className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-bold">salida.json</p>
                    <p className="text-xs text-slate-400 font-normal mt-0.5">{megaResult.stats.procesados} cursos estructurados</p>
                  </div>
                </button>
                {megaResult.errores.length > 0 && (
                  <button onClick={() => { downloadErrorsCSV(megaResult.errores, 'errores_megamatriz.csv'); toast('Descargado', { type: 'success' }) }} className="btn-secondary justify-start gap-3 py-3.5">
                    <Download className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <p className="font-bold">errores_megamatriz.csv</p>
                      <p className="text-xs text-slate-400 font-normal mt-0.5">{megaResult.errores.length} errores de validación</p>
                    </div>
                  </button>
                )}
                {matrixResult.errores.length > 0 && (
                  <button onClick={() => { downloadBase64File(matrixResult.erroresXlsxB64, 'errorM.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Descargado', { type: 'success' }) }} className="btn-secondary justify-start gap-3 py-3.5">
                    <Download className="w-4 h-4 shrink-0" />
                    <div className="text-left">
                      <p className="font-bold">errorM.xlsx</p>
                      <p className="text-xs text-slate-400 font-normal mt-0.5">{matrixResult.errores.length} errores de matriz</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
