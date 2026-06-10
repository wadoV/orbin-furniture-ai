import React, { useEffect } from 'react';
import { Lock, ArrowRight, X } from 'lucide-react';
import { trackEvent, EVENTS } from '../lib/analytics.js';

export const UpgradePrompt = ({ featureName, requiredPlan = 'Pro', price = 'R$99/mês', onClose }) => {
  useEffect(() => {
    trackEvent(EVENTS.PLAN_GATE_VIEWED, { feature: featureName, required_plan: requiredPlan });
  }, [featureName, requiredPlan]);

  const handleUpgradeClick = () => {
    trackEvent(EVENTS.UPGRADE_CTA_CLICKED, { feature: featureName, target_plan: requiredPlan });
    window.location.href = '/pricing';
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
          <div className="space-y-3">
            <button onClick={handleUpgradeClick} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-black font-semibold py-3.5 px-4 rounded-lg transition-all">
              Upgrade para {requiredPlan} — {price}
              <ArrowRight className="w-4 h-4" />
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
