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
  downloadErrorsCSV, downloadJSON, previewFile, processMegamatriz,
  processMatrixFromData, updateEquivalencias,
  type EquivStatus, type FilePreview, type MatrixResult, type MegamatrizResult,
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
    <div className={`card overflow-hidden ${!status.configured ? 'border-oro-200' : ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status.configured ? 'bg-brand-50' : 'bg-oro-50'}`}>
            <Settings className={`w-4 h-4 ${status.configured ? 'text-brand-700' : 'text-oro-600'}`} />
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
            <div className="px-6 pb-5 pt-1 space-y-4 border-t border-brand-100">
              {!status.configured && (
                <div className="p-3.5 bg-oro-50 border border-oro-200 rounded-xl text-sm text-oro-800">
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

// ── Vista previa del archivo ──────────────────────────────────────────────────
function listarFilas(filas: number[], max = 6) {
  const txt = filas.slice(0, max).join(', ')
  return filas.length > max ? `${txt} y ${filas.length - max} más` : txt
}

function FilePreviewPanel({ preview, onConfirm, onReset }: {
  preview: FilePreview
  onConfirm: () => void
  onReset: () => void
}) {
  const ok = preview.faltantes.length === 0
  const conflictos = preview.conflictos
  const conflictosCursos = preview.conflictosCursos
  const hayConflictos = conflictos.length > 0 || conflictosCursos.length > 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <Eye className="w-4 h-4 text-brand-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Verificación del archivo</p>
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

      {/* Estado de hojas */}
      <div className="px-6 py-4 border-b border-brand-100 space-y-3">
        {ok ? (
          <div className="flex items-center gap-3 p-3.5 bg-brand-50 border border-brand-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-brand-700">
                Hojas requeridas encontradas — {preview.cursos} cursos únicos · {preview.indicadores} indicadores distintos
              </p>
              <p className="text-xs text-brand-500 mt-0.5">
                {Object.entries(preview.filasPorHoja).map(([h, n]) => `${h}: ${n} filas`).join(' · ')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Faltan hojas: {preview.faltantes.join(', ')}</p>
              <p className="text-xs text-red-600 mt-0.5">
                El archivo debe tener las hojas T_1, T_2, T_3 y T_5.
              </p>
            </div>
          </div>
        )}
        {ok && conflictosCursos.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 bg-oro-50 border border-oro-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-oro-500 shrink-0 mt-0.5" />
            <p className="text-xs text-oro-800">
              <strong>{conflictosCursos.length} curso{conflictosCursos.length !== 1 ? 's' : ''} se omitirá{conflictosCursos.length !== 1 ? 'n' : ''}:</strong> un
              mismo curso (ID SIGA) debe tener los mismos datos en todas sus filas de T_1 (una por programa). Unifícalos para incluirlos.
            </p>
          </div>
        )}
        {ok && conflictos.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 bg-oro-50 border border-oro-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-oro-500 shrink-0 mt-0.5" />
            <p className="text-xs text-oro-800">
              <strong>{conflictos.length} indicador{conflictos.length !== 1 ? 'es' : ''} se omitirá{conflictos.length !== 1 ? 'n' : ''}:</strong> un
              mismo ID Indicador debe tener la misma descripción y rúbrica en todo el archivo. Corrígelos en la hoja T_2 para incluirlos.
            </p>
          </div>
        )}
      </div>

      {/* Tabla de cursos en conflicto */}
      {ok && conflictosCursos.length > 0 && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto border-b border-brand-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr style={{ backgroundColor: '#00205B' }}>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide w-40">Curso (ID SIGA)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Campos que difieren</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Filas en T_1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {conflictosCursos.map((c) => (
                <tr key={c.idSiga} className="even:bg-brand-50/60 hover:bg-brand-100/60 transition-colors">
                  <td className="px-5 py-3 font-mono font-semibold text-brand-700 whitespace-nowrap">
                    {c.idSiga}<span className="block text-xs font-normal text-slate-500">{c.catalogo}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{c.campos.join(', ')}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{listarFilas(c.filas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de indicadores en conflicto */}
      {ok && conflictos.length > 0 && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr style={{ backgroundColor: '#00205B' }}>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide w-32">ID Indicador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Campos que difieren</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Filas en T_2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {conflictos.map((c) => (
                <tr key={c.id} className="even:bg-brand-50/60 hover:bg-brand-100/60 transition-colors">
                  <td className="px-5 py-3 font-mono font-semibold text-brand-700 whitespace-nowrap">{c.id}</td>
                  <td className="px-5 py-3 text-slate-700">{c.campos.join(', ')}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{listarFilas(c.filas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acciones */}
      <div className="px-6 py-4 border-t border-brand-100 flex items-center justify-between bg-slate-50/50">
        <p className="text-xs text-slate-500">
          {!ok ? 'Corrige el archivo y vuelve a cargarlo.'
            : hayConflictos ? 'Puedes procesar ahora; los cursos e indicadores en conflicto quedarán en el reporte de errores.'
            : 'Todo listo para procesar.'}
        </p>
        <button onClick={onConfirm} disabled={!ok} className="btn-primary">
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
        : 'Leyendo hojas T_1, T_2, T_3, T_5 y construyendo JSON…',
    },
    {
      key: 'matrix' as const, num: '2',
      label: 'Generar Matriz de Competencias',
      sub: matrixStats
        ? `${matrixStats.totalFilas} indicadores · ${matrixStats.totalErrores} errores`
        : 'Generando lista de indicadores (ID y descripción)…',
    },
  ]
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="w-1 h-4 rounded-full bg-brand-700" />
        <h3 className="text-base font-semibold text-brand-700">Progreso del procesamiento</h3>
      </div>
      {items.map(({ key, num, label, sub }, idx) => {
        const state = steps[key]
        return (
          <div key={key}>
            {idx > 0 && <div className="mx-6 border-t border-brand-100" />}
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="shrink-0">
                {state === 'running' ? (
                  <div className="w-9 h-9 rounded-full border-2 border-brand-200 bg-brand-50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-brand-700 animate-spin" />
                  </div>
                ) : state === 'done' ? (
                  <div className="w-9 h-9 rounded-full bg-brand-50 border-2 border-brand-200 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-brand-500" />
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
                  state === 'done' ? 'text-brand-700'
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
  const [filePreview, setFilePreview]   = useState<FilePreview | null>(null)
  const [steps, setSteps]               = useState<Steps>({ mega: 'idle', matrix: 'idle' })
  const [megaResult, setMegaResult]     = useState<MegamatrizResult | null>(null)
  const [matrixResult, setMatrixResult] = useState<MatrixResult | null>(null)
  const [apiError, setApiError]         = useState<string | null>(null)

  useEffect(() => {
    checkEquivStatus().then(setEquivStatus).catch(() => {})
  }, [])

  // ── Fase 1: verificar archivo ──────────────────────────────────────────────
  const handleVerify = async () => {
    if (!mainFile) return
    setPhase('verifying')
    setApiError(null)
    try {
      const preview = await previewFile(mainFile)
      setFilePreview(preview)
      setPhase('preview')
      if (preview.faltantes.length > 0) {
        toast('Faltan hojas en el archivo', { type: 'error', message: preview.faltantes.join(', ') })
      } else if (preview.conflictos.length > 0 || preview.conflictosCursos.length > 0) {
        toast(
          `${preview.conflictosCursos.length} cursos y ${preview.conflictos.length} indicadores en conflicto`,
          { type: 'warning', message: 'Se omitirán al procesar.' },
        )
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
    setMainFile(null); setPhase('upload'); setFilePreview(null)
    setSteps({ mega: 'idle', matrix: 'idle' })
    setMegaResult(null); setMatrixResult(null); setApiError(null)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <h1 className="page-title">Procesar Megamatriz</h1>
        <div className="title-underline" />
        <p className="page-subtitle -mt-4">
          Sube el archivo Omnia.xlsx, verifica su estructura y genera automáticamente el JSON y la Matriz de Competencias.
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
            <h2 className="text-base font-semibold text-brand-700">Archivo de entrada</h2>
          </div>
          <div className="card-body space-y-4">
            <FileDropzone
              label="Seleccionar Omnia.xlsx"
              accept=".xlsx,.xls"
              file={mainFile}
              onChange={(f) => { setMainFile(f); setFilePreview(null) }}
              hint="Excel con hojas T_1, T_2, T_3 y T_5"
              disabled={phase === 'verifying'}
            />

            {!equivStatus.configured && (
              <div className="flex items-center gap-2.5 p-3.5 bg-oro-50 border border-oro-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-oro-500 shrink-0" />
                <p className="text-sm text-oro-800">Configura primero la tabla de equivalencias.</p>
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

            <div className="flex items-center justify-between pt-1 border-t border-brand-100 mt-2">
              <p className="text-xs text-slate-400">
                {!equivStatus.configured ? 'Configura las equivalencias primero'
                  : !mainFile ? 'Selecciona el archivo Excel'
                  : 'Primero se verificará la estructura del archivo'}
              </p>
              <button
                onClick={handleVerify}
                disabled={!mainFile || !equivStatus.configured || phase === 'verifying'}
                className="btn-primary"
              >
                {phase === 'verifying'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Leyendo archivo…</>
                  : <><Eye className="w-4 h-4" />Verificar archivo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FASE: Preview archivo ───────────────────────────────────────────── */}
      {phase === 'preview' && filePreview && (
        <div className="mb-5">
          <FilePreviewPanel
            preview={filePreview}
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
            <div className="flex items-center justify-between p-4 rounded-2xl border border-brand-200 bg-brand-50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand-500" />
                <p className="text-sm font-semibold text-brand-700">Ambos pasos completados exitosamente</p>
              </div>
              <button onClick={handleReset} className="btn-ghost text-brand-700 hover:bg-brand-100 text-sm">
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
              <StatsCard icon={Grid3X3}     label="Indicadores en matriz" value={matrixResult.stats.totalFilas} color="emerald" />
              <StatsCard
                icon={Shield}
                label="Cursos omitidos"
                value={megaResult.stats.cursosOmitidos}
                sub="Sin equivalencia o datos distintos entre programas"
                color={megaResult.stats.cursosOmitidos > 0 ? 'amber' : 'slate'}
              />
              <StatsCard
                icon={Layers}
                label="Indicadores omitidos"
                value={megaResult.stats.indicadoresOmitidos}
                sub="ID con descripción o rúbrica distinta"
                color={megaResult.stats.indicadoresOmitidos > 0 ? 'amber' : 'slate'}
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
                  <h3 className="text-base font-semibold text-brand-700">Vista previa — Matriz de Competencias</h3>
                  <span className="ml-auto text-xs text-slate-400">Primeras 8 filas</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: '#00205B' }}>
                        {['ID Indicador', 'Descripción'].map((h) => (
                          <th key={h} className="text-left px-5 py-3 font-semibold text-white uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {matrixResult.filas.slice(0, 8).map((row, i) => (
                        <tr key={i} className="even:bg-brand-50/60 hover:bg-brand-100/60 transition-colors">
                          <td className="px-5 py-3 font-mono font-semibold text-brand-700 whitespace-nowrap">{row['ID Indicador']}</td>
                          <td className="px-5 py-3 text-slate-600 max-w-[520px] truncate">{row['Descripción']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {matrixResult.filas.length > 8 && (
                    <div className="px-5 py-3 text-center text-xs text-slate-400 border-t border-brand-100 bg-slate-50">
                      +{matrixResult.filas.length - 8} indicadores adicionales en el CSV
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Descargas */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-4 rounded-full bg-brand-700" />
                <h3 className="text-base font-semibold text-brand-700">Archivos generados</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => { downloadCSV(matrixResult.csvContent, 'Matriz_Competencias.csv'); toast('CSV descargado', { type: 'success' }) }} className="btn-primary justify-start gap-3 py-3.5">
                  <Download className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-bold">Matriz_Competencias.csv</p>
                    <p className="text-xs opacity-75 font-normal mt-0.5">{matrixResult.stats.totalFilas} indicadores</p>
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
