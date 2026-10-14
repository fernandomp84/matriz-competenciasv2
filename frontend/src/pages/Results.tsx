import { motion } from 'framer-motion'
import { BarChart3, FileJson, Grid3X3, Layers, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface StoredResult {
  type: 'megamatriz' | 'matrix'
  date: string
  filename: string
  stats: Record<string, number>
}

export default function Results() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<StoredResult[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('processingHistory')
      if (raw) setHistory(JSON.parse(raw).reverse())
    } catch {}
  }, [])

  const clearHistory = () => {
    localStorage.removeItem('processingHistory')
    setHistory([])
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="page-header flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="page-title">Historial de resultados</h1>
          <p className="page-subtitle">Registro de todas las operaciones realizadas en esta sesión.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar historial
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="card p-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-700">Sin resultados aún</p>
            <p className="text-sm text-slate-400 mt-1">
              Procesa la Megamatriz o genera una Matriz de Competencias para ver el historial aquí.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => navigate('/megamatriz')} className="btn-primary">
              <Layers className="w-4 h-4" />
              Procesar Megamatriz
            </button>
            <button onClick={() => navigate('/matrix')} className="btn-secondary">
              <Grid3X3 className="w-4 h-4" />
              Generar Matriz
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="card p-5"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'megamatriz' ? 'bg-brand-100' : 'bg-emerald-100'}`}
                >
                  {item.type === 'megamatriz' ? (
                    <Layers className="w-5 h-5 text-brand-600" />
                  ) : (
                    <Grid3X3 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">{item.filename}</p>
                    <span className={`badge ${item.type === 'megamatriz' ? 'badge-info' : 'badge-success'}`}>
                      {item.type === 'megamatriz' ? 'Megamatriz' : 'Matriz'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {item.type === 'megamatriz' ? (
                      <>
                        <Stat label="Cursos procesados" value={item.stats.procesados} />
                        <Stat label="Errores" value={item.stats.totalErrores} warning={item.stats.totalErrores > 0} />
                        <Stat label="Filas T1" value={item.stats.totalFilasT1} />
                        <Stat label="Tiempo" value={`${item.stats.elapsedMs?.toFixed(0) ?? '—'} ms`} />
                      </>
                    ) : (
                      <>
                        <Stat label="Filas CSV" value={item.stats.totalFilas} />
                        <Stat label="Programas" value={item.stats.programas} />
                        <Stat label="Errores" value={item.stats.totalErrores} warning={item.stats.totalErrores > 0} />
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">
                    {new Date(item.date).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(item.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function Stat({ label, value, warning }: { label: string; value: string | number; warning?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400">{label}:</span>
      <span className={`text-xs font-semibold ${warning ? 'text-red-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}
