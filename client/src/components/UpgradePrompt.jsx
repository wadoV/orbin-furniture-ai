import React, { useEffect } from 'react';
import { Lock, ArrowRight, X } from 'lucide-react';
import { trackEvent, EVENTS } from '../lib/analytics.js';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { useUser } from '../context/UserContext.jsx';
import { api } from '../api/client.js';

export const UpgradePrompt = ({ featureName, requiredPlan = 'Pro', price = 'R$99/mês', onClose }) => {
  const { t, lang } = usePreferences();
  const { user } = useUser();
  
  useEffect(() => {
    trackEvent(EVENTS.PLAN_GATE_VIEWED, { feature: featureName, required_plan: requiredPlan });
  }, [featureName, requiredPlan]);

  const handleUpgradeClick = async () => {
    trackEvent(EVENTS.UPGRADE_CTA_CLICKED, { feature: featureName, target_plan: requiredPlan });
    if (!user || !user.isLoggedIn) {
      window.location.href = '/login';
      return;
    }
    try {
      const planId = requiredPlan.toLowerCase();
      const res = await api.post('/billing/checkout', {
        planId,
        provider: lang === 'PT' ? 'mercadopago' : 'stripe',
        region: lang === 'PT' ? 'BR' : 'US'
      });
      if (res.success && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      alert(err.message || 'Error initiating checkout');
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
          <h2 className="text-2xl font-bold text-white mb-2">{t('up_feature_title').replace('{p}', requiredPlan)}</h2>
          <p className="text-zinc-300 mb-8 leading-relaxed">
            {t('up_gate_desc').replace('{f}', featureName).replace('{p}', requiredPlan)}
          </p>
          <div className=