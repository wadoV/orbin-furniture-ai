/**
 * Blog: Caixa tecnica 13mm para corredicas — PT + ES long-tail
 * Target: "caixa tecnica corredicas telescopicas", "13mm marcenaria", "medida gaveta MDF"
 */
import { Link } from 'react-router-dom'

export default function CaixaTecnica13mm() {
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-[11px] font-black text-black">O</span>
          </div>
          <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
        </Link>
        <Link to="/register" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Comecar Gratis</Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Tecnico</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Caixa Tecnica 13mm: O que e e Como Aplicar em Moveis com Corredicas
          </h1>
          <p className="text-base text-muted leading-relaxed">
            Entenda por que o recuo de 13mm e obrigatorio em modulos com corredicas telescopicas, como calcular corretamente e como o Orbin AI aplica isso automaticamente.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-muted/60">
            <span>Orbin Technologies</span><span>•</span><span>Maio 2026</span><span>•</span><span>6 min leitura</span>
          </div>
        </header>

        <div className="h-px bg-white/5" />

        <div className="space-y-8 text-[15px] leading-relaxed text-white/80">

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">O que e a Caixa Tecnica?</h2>
            <p>
              A <strong className="text-white">caixa tecnica</strong> e o espaco reservado nas laterais de um modulo para acomodar o mecanismo de acionamento das corredicas telescopicas. Sem esse recuo, a gaveta nao fecha completamente ou nao desliza com suavidade.
            </p>
            <p>
              O valor padrao na marcenaria brasileira e de <strong className="text-white">13mm por lado</strong>, totalizando 26mm descontados da largura util da gaveta. Esse valor e especifico para corredicas telescopicas de 45mm de corpo — as mais usadas no mercado nacional.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Como Calcular a Largura da Gaveta</h2>
            <div className="p-5 bg-white/3 border border-white/8 rounded-2xl font-mono text-[13px] space-y-2">
              <p className="text-primary font-bold">Formula:</p>
              <p className="text-white">Largura Gaveta = Largura Modulo - (2 x Espessura Lateral) - (2 x 13mm)</p>
              <div className="h-px bg-white/5 my-2" />
              <p className="text-muted">Exemplo: Modulo 600mm, lateral 18mm</p>
              <p className="text-white">Gaveta = 600 - (2x18) - 26 = <strong>538mm</strong></p>
            </div>
            <p>
              Muitos marceneiros iniciantes esquecem esse calculo e produzem gavetas que nao encaixam. O resultado e retrabalho, perda de material e atraso na entrega.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Tipos de Corredicas e seus Recuos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-muted font-bold">Tipo</th>
                    <th className="text-left py-2 pr-4 text-muted font-bold">Recuo por lado</th>
                    <th className="text-left py-2 text-muted font-bold">Uso comum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ['Telescopica 45mm (padrao)','13mm','Cozinhas, quartos, escritorios'],
                    ['Telescopica 35mm','10mm','Modulos pequenos, banheiros'],
                    ['Oculta (soft-close)','17mm','Cozinhas premium'],
                    ['Americana (corrida)','0mm','Moveis rusticos, workbenches'],
                  ].map(([t,r,u]) => (
                    <tr key={t}>
                      <td className="py-2 pr-4 text-white">{t}</td>
                      <td className="py-2 pr-4 text-primary font-bold">{r}</td>
                      <td className="py-2 text-muted">{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Caixa Tecnica Automatica no Orbin AI</h2>
            <p>
              O Orbin AI aplica os 13mm de caixa tecnica automaticamente sempre que um modulo com gaveta e criado. Voce nao precisa lembrar da formula nem calcular manualmente — o motor parametrico faz isso em tempo real.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                ['1. Informe as dimensoes','Largura, altura e profundidade do modulo'],
                ['2. Selecione gaveta','O motor detecta corredicas automaticamente'],
                ['3. Lista gerada','13mm aplicados, gaveta calculada, lista pronta'],
              ].map(([t,d],i) => (
                <div key={i} className="p-4 bg-white/3 border border-white/5 rounded-xl space-y-1">
                  <p className="text-[11px] font-black text-primary uppercase tracking-widest">{t}</p>
                  <p className="text-[12px] text-muted">{d}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 bg-primary/8 border border-primary/20 rounded-3xl space-y-4 text-center">
          <h3 className="text-lg font-black text-white">Calcule sua caixa tecnica automaticamente</h3>
          <p className="text-[13px] text-muted">Orbin AI aplica os 13mm e gera a lista de corte completa.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-primary/90 transition-all">
            Testar Gratis
          </Link>
        </div>
      </article>
    </div>
  )
}
