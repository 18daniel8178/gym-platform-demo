import { useTheme } from '../context/ThemeContext.jsx'
import { IconSun, IconMoon } from './Icons.jsx'

// className extra permite un estilo distinto en el header vs. flotante (Login/Join)
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? <IconSun width={20} height={20} /> : <IconMoon width={20} height={20} />}
      <span className="tt-label">{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}
