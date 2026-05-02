import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function ValidationReport({ validation }) {
  const { t } = usePreferences()
  if (!validation) return null
  const { status, errors, warnings, summary } = validation
  const isValid = status === 'VALIDADO'

  return (
    <div className={`card border-l-4 ${isValid && !warnings?.length ? 'border-l-success' : isValid ? 'border-l-warning' : 'border-l-danger'}`}>
      <div className="flex items-start gap-3">
        {isValid
          ? <CheckCircle size={20} className="text-success mt-0.5 shrink-0" />
          : <XCircle    size={20} className="text-danger  mt-0.5 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={isValid ? 'badge-validado' : 'badge-rechazado'}>
              {isValid ? '✓' : '✗'} {isValid ? t('validated') : t('rejected')}
            </span>
          </div>
          <p className="text-sm text-muted">{summary}</p>
        </div>
      </div>

      {errors?.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-danger uppercase tracking-wider">{t('critical_errors')}</p>
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              <XCircle size={13} className="text-danger mt-0.5 shrink-0" />
              <span className="text-sm text-white">{e}</span>
            </div>
          ))}
        </div>
      )}

      {warnings?.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-warning uppercase tracking-wider">{t('warnings')}</p>
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
              <span className="text-sm text-white">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
