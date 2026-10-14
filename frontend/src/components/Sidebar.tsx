import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, LayoutDashboard, Layers } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  sub: string
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',    sub: 'Resumen y estadísticas' },
  { to: '/procesar',  icon: Layers,          label: 'Procesar',     sub: 'Megamatriz y Competencias' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col overflow-hidden shrink-0"
      style={{ backgroundColor: '#11225a' }}
    >
      {/* ── Logo área ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center px-4 py-5 shrink-0 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        {collapsed ? (
          /* Escudo solo */
          <div className="w-9 h-9 shrink-0">
            <svg viewBox="36 83 155 210" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path
                fill="#ffffff"
                d="M190,83.5H36.6c-.2,0-.3.1-.3.3v152.6h0c1.1,22.6,27.1,35.2,50.3,37.2h0s0,0,0,0c.5,0,1,0,1.5.1.6,0,1.2,0,1.8.1,1.7.1,3.5.3,5.2.7.7.2,1.4.3,2.1.5,0,0,0,0,0,0,10.2,3.6,14.6,14,15.7,17.2.1.3.5.3.6,0,1.1-3.1,5.4-13.4,15.5-17.1.2,0,.3-.1.5-.2,2.4-.7,4.8-1,7.2-1.1.6,0,1.2,0,1.7-.1,24.1-1.6,51.7-14.7,51.8-38.8V83.9c0-.2-.1-.3-.3-.3Z"
              />
            </svg>
          </div>
        ) : (
          /* Logo completo */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="w-full flex items-center justify-center"
          >
            <img
              src="/logo.svg"
              alt="Logo"
              className="h-14 w-auto object-contain"
            />
          </motion.div>
        )}
      </div>

      {/* ── Etiqueta sección ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 pt-6 pb-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Menú principal
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navegación ────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-hidden">
        {navItems.map(({ to, icon: Icon, label, sub }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group relative',
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {/* Indicador activo */}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white"
                  />
                )}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-white/20' : 'bg-white/8 group-hover:bg-white/15'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                </div>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm font-semibold whitespace-nowrap leading-tight">{label}</p>
                      <p className="text-xs whitespace-nowrap leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {sub}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer colapsar ───────────────────────────────────────────────── */}
      <div className="px-2.5 pb-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronLeft className="w-5 h-5 shrink-0" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm whitespace-nowrap"
              >
                Colapsar menú
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
