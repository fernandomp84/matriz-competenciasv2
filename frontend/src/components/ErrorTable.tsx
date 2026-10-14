import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { MatrixError, ProcessingError } from '../services/api'

type AnyError = ProcessingError | MatrixError

function isProcessingError(e: AnyError): e is ProcessingError {
  return 'hoja' in e
}

interface Props {
  errors: AnyError[]
  title?: string
}

const sheetColors: Record<string, string> = {
  T1: 'bg-red-50 text-red-700',
  T2: 'bg-amber-50 text-amber-700',
  T3: 'bg-orange-50 text-orange-700',
  T5: 'bg-yellow-50 text-yellow-700',
}

export default function ErrorTable({ errors, title = 'Errores detectados' }: Props) {
  const [open, setOpen] = useState(false)

  if (errors.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="badge badge-error">{errors.length}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {isProcessingError(errors[0]) ? (
                  <>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Hoja</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Fila</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">ID SIGA</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Campo</th>
                  </>
                )}
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mensaje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.map((e, i) =>
                isProcessingError(e) ? (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`badge text-xs ${sheetColors[e.hoja] ?? 'bg-slate-100 text-slate-700'}`}>
                        {e.hoja}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{e.fila}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">{e.error}</td>
                  </tr>
                ) : (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{(e as MatrixError).idCursoSiga}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{(e as MatrixError).campo}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs leading-relaxed">{(e as MatrixError).error}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
