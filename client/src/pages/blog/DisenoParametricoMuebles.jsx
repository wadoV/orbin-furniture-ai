/**
 * Blog: Diseno parametrico muebles — ES long-tail
 * Target: "diseño parametrico muebles", "software diseño parametrico cocina", "armario parametrico"
 */
import { Link } from 'react-router-dom'

export default function DisenoParametricoMuebles() {
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-[11px] font-black text-black">O</span>
          </div>
          <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
        </Link>
        <Link to="/register" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Empezar Gratis</Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">Estrategia</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Diseno Parametrico de Muebles: Que es y Por que los Mejores Carpinteros lo Usan
          </h1>
          <p className="text-base text-muted leading-relaxed">
            El diseno parametrico transforma la manera en que los carpinteros crean muebles. En lugar de dibujar cada pieza manualmente, defines las reglas — y el software genera todo automaticamente.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-muted/60">
            <span>Orbin Technologies</span><span>•</span><span>Mayo 2026</span><span>•</span><span>7 min lectura</span>
          </div>
        </header>

        <div className="h-px bg-white/5" />

        <div className="space-y-8 text-[15px] leading-relaxed text-white/80">

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Que es el Diseno Parametrico?</h2>
            <p>
              El <strong className="text-white">diseno parametrico</strong> es un metodo de diseno donde las piezas se definen por relaciones matematicas (parametros) en lugar de medidas fijas. Cuando cambias un parametro — por ejemplo, el ancho del armario — todas las piezas dependientes se recalculan automaticamente.
            </p>
            <p>
              En carpinteria, esto significa que al cambiar de 800mm a 900mm de ancho, la base, el techo, las entrepaños y la lista de corte se actualizan solos, manteniendo todas las reglas de fabricacion (caja tecnica, espesor de material, kerf de sierra).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Diseno Tradicional vs Parametrico</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-red-500/5 border border-red-500/15 rounded-xl space-y-3">
                <p className="text-[11px] font-black text-red-400 uppercase tracking-widest">Diseno Tradicional</p>
                {['Calculas cada pieza manualmente','Un cambio de medida = recalcular todo','Errores aritmeticos frecuentes','Horas en planillas Excel','Lista de corte inconsistente'].map(i => (
                  <p key={i} className="text-[13px] text-muted flex gap-2"><span className="text-red-400">✗</span>{i}</p>
                ))}
              </div>
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-3">
                <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Diseno Parametrico (Orbin AI)</p>
                {['El motor calcula todo automaticamente','Cambia una medida, todo se actualiza','Cero errores aritmeticos','Lista de corte lista en 3 segundos','Reglas de fabricacion siempre aplicadas'].map(i => (
                  <p key={i} className="text-[13px] text-muted flex gap-2"><span className="text-emerald-400">✓</span>{i}</p>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Las Reglas Parametricas del Motor Orbin</h2>
            <p>El motor parametrico de Orbin AI aplica automaticamente las reglas de fabricacion del mercado brasileno y latinoamericano:</p>
            <div className="space-y-3">
              {[
                ['Laterales al piso','Las laterales del armario van del piso al techo, definiendo la altura total del modulo.'],
                ['Base y tapa interna = W - 2T','La base interna se calcula descontando el espesor (T) de cada lateral. Para MDF 18mm: W - 36mm.'],
                ['Caja tecnica 13mm','Recuo automatico de 13mm por lado en modulos con correderas telescopicas.'],
                ['Kerf 3.2mm incluido','Cada corte consume 3.2mm de material. El plano de corte ya lo considera.'],
                ['Veio vertical en zocalos','Los zocalos y paneles frontales tienen el veio en direccion vertical por defecto.'],
              ].map(([t,d],i) => (
                <div key={i} className="flex gap-4 p-4 bg-white/3 border border-white/5 rounded-xl">
                  <span className="text-primary font-black text-[11px] uppercase tracking-widest shrink-0 mt-0.5">{String(i+1).padStart(2,'0')}</span>
                  <div>
                    <p className="font-bold text-white text-[13px]">{t}</p>
                    <p className="text-muted text-[13px] mt-1">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Para Quien es el Diseno Parametrico?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Carpinteros independientes','Aceleran la produccion y reducen errores en proyectos de clientes.'],
                ['Marcenerias industriales','Escalan la produccion con listas de corte estandarizadas y CNC.'],
                ['Estudiantes de carpinteria','Aprenden las reglas de fabricacion correctas desde el principio.'],
                ['Arquitectos e interioristas','Verifican dimensiones y materiales antes de encargar la fabricacion.'],
              ].map(([t,d]) => (
                <div key={t} className="p-4 bg-white/3 border border-white/5 rounded-xl space-y-1">
                  <p className="font-black text-white text-[13px]">{t}</p>
                  <p className="text-muted text-[12px]">{d}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 bg-primary/8 border border-primary/20 rounded-3xl space-y-4 text-center">
          <h3 className="text-lg font-black text-white">Prueba el diseno parametrico ahora — Gratis</h3>
          <p className="text-[13px] text-muted">Sin tarjeta de credito. Hasta 3 modulos gratis.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-primary/90 transition-all">
            Empezar Gratis
          </Link>
        </div>
      </article>
    </div>
  )
}
