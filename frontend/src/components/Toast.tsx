import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useToast, type Toast } from '../hooks/useToast'

const icons = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
  error:   <AlertCircle  className="w-4 h-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info:    <Info         className="w-4 h-4 text-brand-500 shrink-0" />,
}

const borders = {
  success: 'border-l-emerald-500',
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-brand-500',
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast()
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className={`flex items-start gap-3 w-80 bg-white rounded-xl shadow-lg border border-slate-200 border-l-4 px-4 py-3.5 ${borders[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 -mr-1"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export default function ToastContainer() {
  const { toasts } = useToast()
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
