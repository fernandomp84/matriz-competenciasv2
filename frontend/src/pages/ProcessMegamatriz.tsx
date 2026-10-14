import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErrorTable from '../components/ErrorTable'
import FileDropzone from '../components/FileDropzone'
import StatsCard from '../components/StatsCard'
import { useToast } from '../hooks/useToast'
import {
  downloadErrorsCSV,
  downloadJSON,
  processMegamatriz,
  type MegamatrizResult,
} from '../services/api'

function saveToHistory(filename: string, stats: Record<string, number>) {
  try {
    const raw = localStorage.getItem('processingHistory') ?? '[]'
    const history = JSON.parse(raw)
    history.push({ type: 'megamatriz', date: new Date().toISOString(), filename, stats })
    localStorage.setItem('processingHistory', JSON.stringify(history.slice(-20)))
  } catch {}
}

export default function ProcessMegamatriz() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [mainFile, setMainFile] = useState<File | null>(null)
  const [equivFile, setEquivFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MegamatrizResult | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const canProcess = mainFile !== null && equivFile !== null && !loading

  const handleProcess = async () => {
    if (!mainFile || !equivFile) return
    setLoading(true)
    setApiError(null)
    setResult(null)
    const start = Date.now()
    try {
      const data = await processMegamatriz(mainFile)
      const elapsed = Date.now() - start
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed))
      setResult(data)
      saveToHistory(mainFile.name, data.stats as unknown as Record<string, number>)
      toast(`Procesado exitosamente`, {
        type: 'success',
        message: `${data.stats.procesados} cursos · ${data.stats.totalErrores} errores en ${data.stats.elapsedMs.toFixed(0)} ms`,
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        'Error desconocido'
      setApiError(msg)
      toast('Error al procesar', { type: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setMainFile(null)
    setEquivFile(null)
    setResult(null)
    setApiError(null)
  }

  const handleDownloadJSON = () => {
    if (!result) return
    downloadJSON(result.resultado, 'salida.json')
    toast('JSON descargado', { type: 'success' })
  }

  const handleDownloadErrors = () => {
    if (!result) return
    downloadErrorsCSV(result.errores, 'errores.csv')
    toast('CSV de errores descargado', { type: 'success' })
  }

  const handleContinue = () => {
    if (!result) return
    navigate('/matrix', { state: { jsonData: result.resultado } })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="badge badge-info">Paso 1 de 2</span>
        </div>
        <h1 className="page-title">Procesar Megamatriz</h1>
        <p className="page-subtitle">
          Sube el archivo Excel de la Megamatriz y la tabla de equivalencias para generar el JSON estructurado.
        </p>
      </div>

      {/* Upload section */}
      {!result && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-700">Archivos de entrada</h2>
          </div>
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Megamatriz Electivas
                </label>
                <FileDropzone
                  label="Seleccionar Megamatriz.xlsx"
                  accept=".xlsx,.xls"
                  file={mainFile}
                  onChange={setMainFile}
                  hint="Excel con hojas T1, T2, T3 y T5"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Tabla de Equivalencias
                </label>
                <FileDropzone
                  label="Seleccionar Equivalencias.xlsx"
                  accept=".xlsx,.xls"
                  file={equivFile}
                  onChange={setEquivFile}
                  hint="Excel con departamentos y tipos de registro"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error banner */}
            {apiError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Error al procesar</p>
                  <p className="text-sm text-red-600 mt-0.5">{apiError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">
                {!mainFile && !equivFile
                  ? 'Selecciona los dos archivos para continuar'
                  : !mainFile
                  ? 'Falta la Megamatriz'
                  : !equivFile
                  ? 'Falta la Tabla de Equivalencias'
                  : 'Listo para procesar'}
              </p>
              <button
                onClick={handleProcess}
                disabled={!canProcess}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4" />
                    Procesar archivos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card p-8 flex flex-col items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-brand-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-800">Procesando archivos</p>
            <p className="text-sm text-slate-500 mt-1">
              Leyendo hojas T1, T2, T3, T5 y construyendo el JSON estructurado…
            </p>
          </div>
          <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          {/* Success banner */}
          <div className="flex items-start gap-4 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-800">Procesamiento completado</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {result.stats.procesados} cursos procesados en {result.stats.elapsedMs.toFixed(0)} ms
                {result.stats.totalErrores > 0 && ` · ${result.stats.totalErrores} errores registrados`}
              </p>
            </div>
            <button onClick={handleReset} className="btn-ghost text-emerald-700 hover:bg-emerald-100">
              <RefreshCw className="w-4 h-4" />
              Nuevo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard icon={FileJson} label="Cursos" value={result.stats.procesados} color="navy" />
            <StatsCard
              icon={AlertCircle}
              label="Errores totales"
              value={result.stats.totalErrores}
              color={result.stats.totalErrores > 0 ? 'red' : 'emerald'}
            />
            <StatsCard icon={Shield} label="Filas T1" value={result.stats.totalFilasT1} color="slate" />
            <StatsCard
              icon={Clock}
              label="Tiempo"
              value={`${result.stats.elapsedMs.toFixed(0)} ms`}
              color="slate"
            />
          </div>

          {/* Audit */}
          <div className="card p-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <User className="w-4 h-4" />
              <span className="font-medium text-slate-700">{result.audit.usuario}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-500">
              <Server className="w-4 h-4" />
              <span>{result.audit.equipo}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="w-4 h-4" />
              <span>{result.audit.fecha}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2 text-slate-500">
              <FileJson className="w-4 h-4" />
              <span className="font-mono text-xs">{result.audit.archivoFuente}</span>
            </div>
          </div>

          {/* Errors */}
          <ErrorTable errors={result.errores} title={`Errores de validación (${result.errores.length})`} />

          {/* Downloads & continue */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Archivos generados</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleDownloadJSON} className="btn-secondary">
                <Download className="w-4 h-4" />
                Descargar salida.json
              </button>
              {result.errores.length > 0 && (
                <button onClick={handleDownloadErrors} className="btn-secondary">
                  <Download className="w-4 h-4" />
                  Descargar errores.csv
                </button>
              )}
              <div className="flex-1" />
              <button onClick={handleContinue} className="btn-primary">
                Continuar → Generar Matriz
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
