import React from 'react'
import { Link } from 'react-router-dom'
import { Shield, FileText, ArrowLeft } from 'lucide-react'

function LegalLayout({ children, title, icon: Icon }) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-white transition-colors">
          <ArrowLeft size={14} /> Volver al Inicio
        </Link>
        <div className="card p-8 bg-surface-2/60 border border-white/5 rounded-3xl relative overflow-hidden space-y-6">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Icon size={20} />
            </div>
            <h1 className="text-xl font-black uppercase tracking-wider">{title}</h1>
          </div>
          <div className="prose prose-invert max-w-none text-xs text-muted leading-relaxed space-y-4 font-medium">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TermsOfService() {
  return (
    <LegalLayout title="Términos de Servicio" icon={FileText}>
      <p className="text-sm font-semibold text-white">Última actualización: Junio de 2026</p>
      <p>
        Bienvenido a Orbin AI. Al acceder y utilizar nuestra plataforma de diseño paramétrico, usted acepta y se compromete a cumplir con los siguientes términos de servicio.
      </p>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider pt-2">1. Uso de la Plataforma</h2>
      <p>
        Orbin AI proporciona herramientas de modelado 3D, despieces, y optimización de nesting para carpintería. La licencia se otorga según el plan suscrito (Free, Pro o Industrial). El uso no autorizado o perjudicial de la plataforma resultará en la cancelación inmediata de la cuenta.
      </p>
      <h2 className="text-sm font-bold text-[#F5A623] uppercase tracking-wider pt-2 border-l-2 border-[#F5A623] pl-2 bg-[#F5A623]/5 py-1">
        2. Limitación de Responsabilidad Técnica y de Fabricación
      </h2>
      <p className="font-semibold text-white">
        IMPORTANTE: Orbin AI es una herramienta de asistencia al diseño paramétrico. Los algoritmos de despiece (incluyendo closetEngine.js), optimización de corte, marcas de tapacantos, y planos ejecutivos generados por el software son sugerencias computacionales basadas en los parámetros ingresados por el usuario.
      </p>
      <p className="bg-red-500/5 border border-red-500/10 p-3 rounded-xl">
        Bajo ninguna circunstancia Orbin AI, sus directores, empleados o desarrolladores serán responsables por pérdidas financieras, desperdicio de material (placas de MDF/MDP), fallas estructurales, ensambles defectuosos, colisiones físicas, daños en maquinaria CNC, o cualquier otro perjuicio derivado de la fabricación industrial de muebles basados en los archivos o listas de corte generados. <strong>Es responsabilidad absoluta del fabricante/carpintero verificar manualmente las dimensiones, holguras y tolerancias técnicas antes de realizar cualquier corte o maquinado físico.</strong>
      </p>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider pt-2">3. Propiedad Intelectual</h2>
      <p>
        Todo el software, las interfaces visuales, los algoritmos matemáticos y las marcas comerciales asociadas son propiedad exclusiva de Orbin AI.
      </p>
    </LegalLayout>
  )
}

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Política de Privacidad (LGPD)" icon={Shield}>
      <p className="text-sm font-semibold text-white">Última actualización: Junio de 2026</p>
      <p>
        En Orbin AI nos tomamos muy en serio la protección de sus datos personales. Esta política de privacidad detalla cómo recopilamos, almacenamos y procesamos su información conforme a la Ley General de Protección de Datos (LGPD).
      </p>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider pt-2">1. Recopilación de Información</h2>
      <p>
        Recopilamos información de inicio de sesión (correo electrónico, contraseña cifrada), configuraciones predeterminadas de la empresa (Nombre de Empresa, Teléfono, Dirección) con fines de personalización de marca blanca, y metadatos de los proyectos diseñados para permitir el autoguardado en local.
      </p>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider pt-2">2. Derechos del Usuario</h2>
      <p>
        El usuario tiene derecho a solicitar el acceso, la rectificación o la eliminación permanente de sus datos del sistema en cualquier momento enviando una solicitud.
      </p>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider pt-2">3. Seguridad de Datos</h2>
      <p>
        Implementamos medidas técnicas avanzadas para salvaguardar la información personal y los diseños contra accesos no autorizados.
      </p>
    </LegalLayout>
  )
}
