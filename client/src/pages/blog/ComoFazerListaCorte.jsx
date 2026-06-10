/**
 * Blog: Como fazer lista de corte MDF — long-tail PT
 * Target: "como fazer lista de corte mdf", "lista de corte automatica", "software marcenaria"
 */
import { Link } from 'react-router-dom'
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx'

export default function ComoFazerListaCorte() {
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 300 360" className="w-5 h-5" fill="none" aria-hidden="true">
              <g transform="rotate(35 150 180)">
                <path fill="none" stroke="#0E0E0E" strokeWidth="7" d="M64,120 C40,180 44,250 92,294 C140,334 206,322 232,268"/>
                <path fillRule="evenodd" fill="#0E0E0E" d="M150,20 C200,20 240,60 240,112 C240,176 214,242 182,292 C170,316 124,316 112,292 C82,242 58,176 58,112 C58,60 100,20 150,20 Z M145,118 A46,46 0 0 1 191,164 L191,214 A46,46 0 0 1 99,214 L99,164 A46,46 0 0 1 145,118 Z"/>
              </g>
            </svg>
          </div>
          <span className="text-sm font-black text-white uppercase tracking-widest">Orbin AI</span>
        </Link>
        <LanguageSwitcher />
        <Link to="/register" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
          Comecar Gratis
        </Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">Guia Tecnico</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Como Fazer Lista de Corte MDF: Guia Completo para Marceneiros
          </h1>
          <p className="text-base text-muted leading-relaxed">
            Aprenda a gerar listas de corte MDF precisas, evitar desperdicio de chapa e usar software automatico para calcular todas as pecas do seu movel em segundos.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-muted/60">
            <span>Orbin Technologies</span>
            <span>•</span>
            <span>Maio 2026</span>
            <span>•</span>
            <span>8 min leitura</span>
          </div>
        </header>

        <div className="h-px bg-white/5" />

        <div className="prose prose-invert max-w-none space-y-8 text-[15px] leading-relaxed text-white/80">

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">O que e uma Lista de Corte MDF?</h2>
            <p>
              Uma <strong className="text-white">lista de corte MDF</strong> e um documento tecnico que especifica todas as pecas necessarias para fabricar um movel, com dimensoes exatas (largura x altura x espessura), quantidade e direcao do veio da madeira. E o ponto de partida para qualquer producao eficiente em marcenaria.
            </p>
            <p>
              Sem uma lista de corte precisa, voce corre o risco de comprar material em excesso, fazer cortes errados e desperdicar horas de trabalho. Com uma lista correta, a producao flui: cada peca vai direto para a serra com medidas exatas.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Os 5 Erros Mais Comuns ao Fazer Lista de Corte</h2>
            <div className="space-y-3">
              {[
                ['Esquecer o kerf da lama', 'Cada corte consome 3.2mm de material (kerf). Ignorar isso em chapas de 2750x1840mm gera erros acumulados que invalidam a lista.'],
                ['Ignorar a caixa tecnica 13mm', 'Modulos com corredicas telescopicas precisam de 13mm de recuo de cada lado. Sem isso, a gaveta nao fecha.'],
                ['Laterais que nao vao ao chao', 'A regra DNA V1 da marcenaria brasileira determina que as laterais do armario vao do chao ao topo, e as bases/tampos internas sao descontadas da espessura.'],
                ['Nao incluir a margem de chapa', 'As normas brasileiras reservam 50mm de margem na chapa. Desconsiderar isso gera pecas que nao cabem no plano de corte.'],
                ['Calcular na mao em planilha', 'Erros aritmeticos custam caro. Software especializado elimina esse risco completamente.'],
              ].map(([title, desc], i) => (
                <div key={i} className="flex gap-3 p-4 bg-white/3 border border-white/5 rounded-xl">
                  <span className="text-primary font-black text-sm shrink-0">{i+1}.</span>
                  <div>
                    <p className="font-bold text-white text-[13px]">{title}</p>
                    <p className="text-muted text-[13px] mt-1">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Como Gerar Lista de Corte Automatica com Orbin AI</h2>
            <p>
              O <strong className="text-white">Orbin AI</strong> e um software de marcenaria parametrica que gera listas de corte automaticamente. Voce informa as dimensoes do movel (largura, altura, profundidade) e o tipo de modulo, e o motor calcula todas as pecas com:
            </p>
            <ul className="space-y-2 list-none">
              {[
                'Laterais ao chao (regra DNA V1)',
                'Base e tampo interno com W-2T (descontando espessura das laterais)',
                'Caixa tecnica 13mm automatica para corredicas',
                'Kerf 3.2mm e margem 50mm ja incluidos',
                'Suporte a MDF 15mm, 18mm e 25mm',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px]">
                  <span className="text-primary mt-0.5">•</span>{item}
                </li>
              ))}
            </ul>
            <div className="p-5 bg-primary/8 border border-primary/20 rounded-2xl space-y-3">
              <p className="text-[13px] font-bold text-primary">Exemplo pratico:</p>
              <p className="text-[13px] text-white/80">
                Armario 800mm x 2200mm x 600mm em MDF 18mm com 4 prateleiras e caixa para gaveta:
                o Orbin gera automaticamente 14 pecas com dimensoes exatas, identificacao de veio,
                plano de corte otimizado e custo estimado de material — em menos de 3 segundos.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Normas Brasileiras MDF/MDP 2026</h2>
            <p>As chapas de MDF e MDP padrao brasileiro medem <strong className="text-white">2750 x 1840mm</strong> (ou 2800 x 2070mm no formato maior). O Orbin AI usa os seguintes parametros por padrao:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-muted font-bold">Parametro</th>
                    <th className="text-left py-2 text-white font-bold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ['Tamanho da chapa','2750 x 1840mm'],
                    ['Kerf (espessura da lama)','3.2mm'],
                    ['Margem de borda','50mm'],
                    ['Caixa tecnica (corredicas)','13mm por lado'],
                    ['Espessuras suportadas','15mm, 18mm, 25mm'],
                  ].map(([k,v]) => (
                    <tr key={k}>
                      <td className="py-2 pr-4 text-muted">{k}</td>
                      <td className="py-2 text-white">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black text-white">Conclusao</h2>
            <p>
              Fazer uma lista de corte MDF correta e a base de qualquer producao de moveis eficiente. Usando software especializado como o Orbin AI, voce elimina erros, reduz desperdicio e acelera a producao.
            </p>
          </section>
        </div>

        <div className="p-6 bg-primary/8 border border-primary/20 rounded-3xl space-y-4 text-center">
          <h3 className="text-lg font-black text-white">Gere sua lista de corte agora — Gratis</h3>
          <p className="text-[13px] text-muted">Sem cartao de credito. Ate 3 modulos gratuitamente.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-primary/90 transition-all">
            Comecar Gratis
          </Link>
        </div>
      </article>
    </div>
  )
}
