import { FileCheck, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

interface Props {
  label: string
  accept: string
  file: File | null
  onChange: (file: File | null) => void
  hint?: string
  disabled?: boolean
}

export default function FileDropzone({ label, accept, file, onChange, hint, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = e.dataTransfer.files[0]
    if (dropped) onChange(dropped)
  }, [onChange, disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }, [disabled])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (file) {
    return (
      <div className="flex items-center gap-4 p-4 bg-brand-50 border-2 border-brand-200 rounded-xl">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#11225a' }}>
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{formatSize(file.size)}</p>
        </div>
        {!disabled && (
          <button
            onClick={() => onChange(null)}
            className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      className={[
        'w-full flex flex-col items-center gap-3 p-7 rounded-xl border-2 border-dashed',
        'transition-all duration-200 cursor-pointer',
        dragging
          ? 'border-brand-400 bg-brand-50 scale-[1.01]'
          : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/40',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragging ? 'bg-brand-100' : 'bg-white border border-slate-200 shadow-sm'}`}>
        <Upload className={`w-5 h-5 ${dragging ? 'text-brand-700' : 'text-slate-400'}`} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        <p className="text-xs text-brand-500 font-medium mt-2">Arrastra el archivo aquí o haz clic para seleccionar</p>
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = '' }} className="sr-only" />
    </button>
  )
}
