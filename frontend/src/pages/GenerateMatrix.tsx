import { motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileJson,
  Grid3X3,
  Layers,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ErrorTable from '../components/ErrorTable'
import FileDropzone from '../components/FileDropzone'
import StatsCard from '../components/StatsCard'
import { useToast } from '../hooks/useToast'
import {
  downloadBase64File,
  downloadCSV,
  processMatrixFromData,
  type MatrixResult,
} from '../services/api'

function saveToHistory(filename: string, stats: Record<string, number>) {
  try {
    const raw = localStorage.getItem('processingHistory') ?? '[]'
    const history = JSON.parse(raw)
    history.push({ type: 'matrix', date: new Date().toISOString(), filename, stats })
    localStorage.setItem('processingHistory', JSON.stringify(history.slice(-20)))
  } catch {}
}

export default function GenerateMatrix() {
  const location = useLocation()
  const { toast } = useToast()

  const passedJsonData = (location.state as { jsonData?: object } | null)?.jsonData ?? null

  const [jsonFile, setJsonFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MatrixResult | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [autoProcessed, setAutoProcessed] = useState(false)

  // Auto-process if JSON data was passed from ProcessMegamatriz
  useEffect(() => {
    if (passedJsonData && !autoProcessed && !result) {
      setAutoProcessed(true)
      runWithData(passedJsonData)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runWithData = async (data: object) => {
    setLoading(true)
    setApiError(null)
    setResult(null)
    const start = Date.now()
    try {
      const res = await processMatrixFromData(data)
      const elapsed = Date.now() - start
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed))
      setResult(res)
      saveToHistory('salida.json', res.stats as unknown as Record<string, number>)
      toast('Matriz generada exitosamente', {
        type: 'success',
        message: `${res.stats.totalFilas} filas · ${res.stats.programas} programas`,
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        'Error desconocido'
      setApiError(msg)
      toast('Error al generar matriz', { type: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!jsonFile) return
    setLoading(true)
    setApiError(null)
    setResult(null)
    const start = Date.now()
    try {
      const text = await jsonFile.text()
      const data = JSON.parse(text)
      const res = await processMatrixFromData(data)
      const elapsed = Date.now() - start
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed))
      setResult(res)
      saveToHistory(jsonFile.name, res.stats as unknown as Record<string, number>)
      toast('Matriz generada exitosamente', {
        type: 'success',
        message: `${res.stats.totalFilas} filas · ${res.stats.programas} programas`,
      })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ??
        'Error desconocido'
      setApiError(msg)
      toast('Error al generar matriz', { type: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setJsonFile(null)
    setResult(null)
    setApiError(null)
  }

  const handleDownloadCSV = () => {
    if (!result) return
    downloadCSV(result.csvContent, 'Matriz_Competencias.csv')
    toast('CSV descargado', { type: 'success' })
  }

  const handleDownloadErrors = () => {
    if (!result) return
    downloadBase64File(
      result.erroresXlsxB64,
      'errorM.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    toast('Reporte de errores descargado', { type: 'success' })
  }

  const canProcess = jsonFile !== null && !loading

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Grid3X3 className="w-4 h-4 text-white" />
          </div>
          <span className="badge badge-success">Paso 2 de 2</span>
        </div>
        <h1 className="page-title">Generar Matriz de Competencias</h1>
        <p className="page-subtitle">
          Toma el JSON generado en el paso anterior y construye la jerarquía Programa → MetaCompetencia → RA → Indicador.
        </p>
      </div>

      {/* Auto-passed data banner */}
      {passedJsonData && (
        <div className="flex items-center gap-3 p-4 bg-brand-50 border border-brand-200 rounded-xl mb-5">
          <Layers className="w-4 h-4 text-brand-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-800">Usando JSON del paso anterior</p>
            <p className="text-xs text-brand-600 mt-0.5">
              Datos de la Megamatriz pasados automáticamente desde el Paso 1
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-brand-400" />
        </div>
      )}

      {/* Upload section — only if no passedJsonData and no result */}
      {!passedJsonData && !result && !loading && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-700">Archivo de entrada</h2>
          </div>
          <div className="card-body space-y-5">
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                JSON de salida (salida.json)
              </label>
              <FileDropzone
                label="Seleccionar salida.json"
                accept=".json"
                file={jsonFile}
                onChange={setJsonFile}
                hint="Generado por el Paso 1 — Procesar Megamatriz"
                disabled={loading}
              />
            </div>

            {apiError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Error al generar</p>
                  <p className="text-sm text-red-600 mt-0.5">{apiError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">
                {!jsonFile ? 'Selecciona el JSON para continuar' : 'Listo para generar'}
              </p>
              <button onClick={handleProcess} disabled={!canProcess} className="btn-primary">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <Grid3X3 className="w-4 h-4" />
                    Generar matriz
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-8 flex flex-col items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-800">Generando matriz de competencias</p>
            <p className="text-sm text-slate-500 mt-1">
              Construyendo jerarquía Programa → MetaCompetencia → RA → Indicador…
            </p>
          </div>
          <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-pulse w-2/3" />
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
              <p className="font-semibold text-emerald-800">Matriz generada exitosamente</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {result.stats.totalFilas} filas · {result.stats.programas} programas raíz
                {result.stats.totalErrores > 0 && ` · ${result.stats.totalErrores} errores`}
              </p>
            </div>
            <button onClick={handleReset} className="btn-ghost text-emerald-700 hover:bg-emerald-100">
              <RefreshCw className="w-4 h-4" />
              Nuevo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatsCard icon={Grid3X3} label="Total filas" value={result.stats.totalFilas} color="emerald" />
            <StatsCard icon={FileJson} label="Programas raíz" value={result.stats.programas} color="navy" />
            <StatsCard
              icon={AlertCircle}
              label="Errores"
              value={result.stats.totalErrores}
              color={result.stats.totalErrores > 0 ? 'red' : 'emerald'}
            />
          </div>

          {/* Errors */}
          <ErrorTable errors={result.errores} title={`Errores de validación (${result.errores.length})`} />

          {/* Preview */}
          <div className="card overflow-hidden">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Vista previa de la matriz</h3>
              <span className="text-xs text-slate-400">Primeras 10 filas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['ID Paterno', 'ID Nodo', 'Nombre corto', 'Fmt'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.filas.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-slate-400 max-w-[120px] truncate">
                        {row['Número ID paterno'] || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-700 font-medium max-w-[160px] truncate">
                        {row['Número ID']}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-[240px] truncate">
                        {row['Nombre_corto']}
                      </td>
                      <td className="px-4 py-2.5 text-center text-slate-400">{row['Formato de descripción']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.filas.length > 10 && (
                <div className="px-4 py-3 text-center text-xs text-slate-400 border-t border-slate-100">
                  +{result.filas.length - 10} filas más en el CSV descargado
                </div>
              )}
            </div>
          </div>

          {/* Downloads */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Archivos generados</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleDownloadCSV} className="btn-primary">
                <Download className="w-4 h-4" />
                Descargar Matriz_Competencias.csv
              </button>
              <button onClick={handleDownloadErrors} className="btn-secondary">
                <Download className="w-4 h-4" />
                Descargar errorM.xlsx
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
