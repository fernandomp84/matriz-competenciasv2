import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, FileJson, Grid3X3, Layers, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatsCard from '../components/StatsCard'

interface StoredResult {
  type: 'megamatriz' | 'matrix'
  date: string
  filename: string
  stats: Record<string, number>
}

const fade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } }

export default function Dashboard() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<StoredResult[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('processingHistory')
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  }, [])

  const lastMega   = history.filter((h) => h.type === 'megamatriz').at(-1)
  const lastMatrix = history.filter((h) => h.type === 'matrix').at(-1)
  const totalCourses = lastMega?.stats.procesados ?? 0
  const totalErrors  = lastMega?.stats.totalErrores ?? 0
  const totalRows    = lastMatrix?.stats.totalFilas ?? 0

  return (
    <motion.div {...fade}>

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 p-8" style={{ background: 'linear-gradient(135deg, #11225a 0%, #1e3a88 60%, #2f508e 100%)' }}>
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-medium mb-1 uppercase tracking-widest">
                Sistema de gestión
              </p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Matriz de Competencias <span className="text-white/60 text-xl font-semibold">v2</span>
              </h1>
              <p className="mt-2 text-white/70 text-sm leading-relaxed max-w-xl">
                Herramienta de procesamiento para la Megamatriz (Omnia.xlsx). Genera automáticamente el JSON estructurado y la Matriz de Competencias CSV.
              </p>
            </div>
            <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <p className="text-white/50 text-xs">Última actualización</p>
                <p className="text-white text-sm font-medium">
                  {lastMega ? new Date(lastMega.date).toLocaleDateString('es-CO', { dateStyle: 'medium' }) : 'Sin datos'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/procesar')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 text-sm font-bold rounded-lg hover:bg-brand-50 transition-colors shadow-sm"
          >
            <Layers className="w-4 h-4" />
            Procesar nueva Megamatriz
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatsCard
          icon={FileJson}
          label="Cursos procesados"
          value={totalCourses}
          sub={lastMega ? lastMega.filename : 'Sin procesamiento aún'}
          color="navy"
        />
        <StatsCard
          icon={XCircle}
          label="Errores registrados"
          value={totalErrors}
          sub={totalErrors === 0 ? 'Sin errores' : `${totalErrors} fila(s) con error`}
          color={totalErrors > 0 ? 'red' : 'emerald'}
        />
        <StatsCard
          icon={CheckCircle2}
          label="Filas en la matriz"
          value={totalRows}
          sub={lastMatrix ? new Date(lastMatrix.date).toLocaleDateString('es-CO') : 'Sin generar aún'}
          color="emerald"
        />
      </div>

      {/* ── Flujo ───────────────────────────────────────────────────────────── */}
      <div className="card mb-8">
        <div className="card-header">
          <div className="w-1 h-4 rounded-full bg-brand-700" />
          <h2 className="text-sm font-semibold text-brand-700">Flujo de procesamiento</h2>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Omnia.xlsx', sub: 'T_1 · T_2 · T_3 · T_5', bg: 'bg-brand-50',   text: 'text-brand-700' },
              { label: 'Equivalencias.xlsx', sub: 'Depts. y tipos',   bg: 'bg-brand-50',   text: 'text-brand-700' },
            ].map((item) => (
              <div key={item.label} className={`px-4 py-3 rounded-xl ${item.bg} ${item.text} text-center border border-brand-100`}>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="text-xs opacity-60 mt-0.5">{item.sub}</p>
              </div>
            ))}

            <div className="flex items-center gap-1 text-slate-300">
              <div className="w-8 h-px bg-slate-200" />
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="px-4 py-3 rounded-xl bg-brand-700 text-white text-center">
              <p className="text-xs font-bold">Paso 1</p>
              <p className="text-xs opacity-70 mt-0.5">salida.json + errores.csv</p>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <div className="w-8 h-px bg-slate-200" />
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="px-4 py-3 rounded-xl bg-emerald-600 text-white text-center">
              <p className="text-xs font-bold">Paso 2</p>
              <p className="text-xs opacity-80 mt-0.5">Matriz_Competencias.csv</p>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <div className="w-8 h-px bg-slate-200" />
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-center">
              <p className="text-xs font-bold">errorM.xlsx</p>
              <p className="text-xs opacity-70 mt-0.5">Reporte de errores</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Acceso rápido ───────────────────────────────────────────────────── */}
      <motion.button
        onClick={() => navigate('/procesar')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.995 }}
        className="w-full card p-6 text-left hover:shadow-lg transition-all duration-200 group mb-8"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#11225a' }}>
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-1">Acción principal</p>
            <h3 className="text-lg font-bold text-brand-700 mb-1.5">Procesar Megamatriz</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Sube el archivo Excel y el sistema ejecuta automáticamente los dos pasos: genera el JSON estructurado y la Matriz de Competencias CSV lista para importar en el sistema académico.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="badge badge-info">
                <Grid3X3 className="w-3 h-3" />
                Paso 1 automático
              </span>
              <span className="badge badge-success">
                <CheckCircle2 className="w-3 h-3" />
                Paso 2 automático
              </span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-brand-300 group-hover:text-brand-700 group-hover:translate-x-1 transition-all duration-150 mt-1 shrink-0" />
        </div>
      </motion.button>

      {/* ── Historial ───────────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="w-1 h-4 rounded-full bg-brand-700" />
            <h2 className="text-sm font-semibold text-brand-700">Historial de procesamiento</h2>
            <button
              onClick={() => { localStorage.removeItem('processingHistory'); setHistory([]) }}
              className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Limpiar
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {history.slice().reverse().slice(0, 8).map((item, i) => (
              <div key={i} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${item.type === 'megamatriz' ? 'bg-brand-700' : 'bg-emerald-500'}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.filename}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.type === 'megamatriz'
                        ? `${item.stats.procesados} cursos · ${item.stats.totalErrores} errores`
                        : `${item.stats.totalFilas} indicadores`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className={`badge text-xs ${item.type === 'megamatriz' ? 'badge-info' : 'badge-success'}`}>
                    {item.type === 'megamatriz' ? 'Megamatriz' : 'Matriz'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(item.date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
