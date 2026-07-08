import React, { useEffect, useState } from 'react';
import { Lock, ArrowRight, X, Loader2 } from 'lucide-react';
import { trackEvent, EVENTS } from '../lib/analytics.js';
import { api } from '../api/client.js';

// RECOVERY [2026-06-26]: handleUpgradeClick redirigía a /pricing (placeholder).
// Ahora dispara un checkout real vía POST /billing/checkout (Stripe/Mercado Pago)
// y redirige al checkoutUrl devuelto. Mapeo plan display → planId del backend.
const PLAN_ID_MAP = { pro: 'pro', enterprise: 'enterprise', industrial: 'enterprise', empresa: 'enterprise' }

function resolvePlanId(requiredPlan) {
  const key = String(requiredPlan || '').trim().toLowerCase()
  return PLAN_ID_MAP[key] || 'pro'
}

function detectRegion() {
  try {
    const lang = (navigator.language || navigator.languages?.[0] || '').toLowerCase()
    if (lang.startsWith('pt')) return 'BR'
  } catch {}
  return undefined
}

export const UpgradePrompt = ({ featureName, requiredPlan = 'Pro', price = 'R$99/mês', onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    trackEvent(EVENTS.PLAN_GATE_VIEWED, { feature: featureName, required_plan: requiredPlan });
  }, [featureName, requiredPlan]);

  const handleUpgradeClick = async () => {
    trackEvent(EVENTS.UPGRADE_CTA_CLICKED, { feature: featureName, target_plan: requiredPlan });
    setError('')
    setLoading(true)
    try {
      const planId = resolvePlanId(requiredPlan)
      const data = await api.createCheckout(planId, undefined, detectRegion())
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('No se recibió la URL de checkout.')
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el checkout. Intente nuevamente.')
      setLoading(false)
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative border border-white/10">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="p-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-5">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Recurso {requiredPlan}</h2>
          <p className="text-zinc-300 mb-8 leading-relaxed">
            O recurso <strong className="text-white">{featureName}</strong> é exclusivo para assinantes do plano {requiredPlan}. Atualize agora para desbloquear esta funcionalidade.
          </p>
          {error && (
            <p className="text-[12px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4 text-center">{error}</p>
          )}
          <div className="space-y-3">
            <button onClick={handleUpgradeClick} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-black font-semibold py-3.5 px-4 rounded-lg transition-all">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Upgrade para {requiredPlan} — {price}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <a href="/pricing" className="w-full flex items-center justify-center text-zinc-400 hover:text-white font-medium py-3 px-4 rounded-lg transition-colors">
              Ver todos os planos
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
