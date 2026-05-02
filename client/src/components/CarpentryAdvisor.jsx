import { Info, Wrench, CheckCircle2, AlertTriangle, Ruler } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function CarpentryAdvisor({ design }) {
  const { t } = usePreferences()
  if (!design?.configuration) return null

  const cfg = design.configuration
  const tips = []

  // 1. Structural tips
  if (cfg.height > 2400) {
    tips.push({
      icon: <AlertTriangle className="text-amber-500" size={16} />,
      title: 'Altura Crítica',
      text: 'Muebles de más de 2.40m pueden requerir juntas de expansión o divisiones estructurales para evitar el pandeo de los laterales.'
    })
  }

  if (cfg.width > 1200) {
    tips.push({
      icon: <Ruler className="text-blue-500" size={16} />,
      title: 'Refuerzo Central',
      text: 'Para anchos mayores a 1.20m, se recomienda un montante central (divisoria) para soportar el peso de los estantes y el techo.'
    })
  }

  // 2. Drawer tips
  if (cfg.numDrawers > 4) {
    tips.push({
      icon: <Wrench className="text-primary" size={16} />,
      title: 'Peso de Gavetas',
      text: 'Demasiadas gavetas en un solo bloque aumentan la carga en los laterales. Asegúrate de usar correderas telescópicas de alta capacidad (45kg+).'
    })
  }

  // 3. Technical Wisdom
  tips.push({
    icon: <CheckCircle2 className="text-green-500" size={16} />,
    title: 'Fundo Completo (Estándar)',
    text: 'Por defecto, todos los módulos Orbin incluyen un fondo estructural completo para garantizar la estabilidad lateral del armario.'
  })

  tips.push({
    icon: <CheckCircle2 className="text-green-500" size={16} />,
    title: 'Protección de Humedad',
    text: 'El rodapié con retranqueo y niveladores protege el MDF de la limpieza diaria y posibles filtraciones.'
  })

  return (
    <div className="bg-surface/60 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5 bg-white/5">
        <div className="p-2 bg-primary/20 rounded-lg text-primary">
          <Info size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">{t('carpentry_wisdom')}</h3>
          <p className="text-[10px] text-muted uppercase tracking-wider font-medium">{t('technical_advisor')}</p>
        </div>
      </div>
      
      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-3 group">
            <div className="mt-0.5 shrink-0 transition-transform group-hover:scale-110">
              {tip.icon}
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors">{tip.title}</h4>
              <p className="text-[11px] text-muted leading-relaxed">{tip.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-primary/5 border-t border-white/5">
        <p className="text-[10px] text-primary/80 italic text-center">
          "Un buen diseño empieza por una estructura sólida."
        </p>
      </div>
    </div>
  )
}
