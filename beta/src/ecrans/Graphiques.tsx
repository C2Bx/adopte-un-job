/* Des graphiques en SVG, sans bibliothèque : une courbe, des barres, un
   entonnoir, un anneau. Une seule échelle par graphique, chaque repère nomme
   une valeur atteinte, et les couleurs viennent des jetons du thème pour
   tenir en clair comme en sombre. Ce sont des graphiques qu'on lit, pas des
   décorations qu'on regarde. */

const TEINTES = ['var(--brand)', 'var(--accent)', 'var(--yes)', 'var(--no)', 'var(--ink-3)', 'var(--brand-soft)']

export function Courbe({ series, hauteur = 140 }: {
  series: { nom: string; points: { jour: string; n: number }[]; teinte?: string }[]
  hauteur?: number
}) {
  const largeur = 520
  const g = { g: 28, d: 8, h: 10, b: 22 }
  const n = series[0]?.points.length ?? 0
  if (!n) return null
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.n)))
  const x = (i: number) => g.g + (i / Math.max(1, n - 1)) * (largeur - g.g - g.d)
  const y = (v: number) => g.h + (1 - v / max) * (hauteur - g.h - g.b)
  const pas = Math.max(1, Math.round(n / 6))
  return (
    <svg className="graphe" viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={series.map((s) => s.nom).join(', ')}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={g.g} x2={largeur - g.d} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" />
          <text x={g.g - 4} y={y(max * f) + 3.5} textAnchor="end" fontSize="9" fill="var(--ink-3)">{Math.round(max * f)}</text>
        </g>
      ))}
      {series[0]!.points.map((p, i) => (i % pas === 0 || i === n - 1) && (
        <text key={p.jour} x={x(i)} y={hauteur - 6} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{p.jour.slice(8, 10)}/{p.jour.slice(5, 7)}</text>
      ))}
      {series.map((s, k) => {
        const t = s.teinte ?? TEINTES[k % TEINTES.length]!
        const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join(' ')
        const dernier = s.points[n - 1]!
        return (
          <g key={s.nom}>
            <path d={`${d} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`} fill={t} opacity=".08" />
            <path d={d} fill="none" stroke={t} strokeWidth="2" strokeLinejoin="round" />
            <circle cx={x(n - 1)} cy={y(dernier.n)} r="3" fill={t} />
          </g>
        )
      })}
    </svg>
  )
}

export function Barres({ donnees, teinte = 'var(--brand)', max: maxImpose }: {
  donnees: { valeur: string; n: number }[]
  teinte?: string
  max?: number
}) {
  if (!donnees.length) return <p className="pa">Rien à montrer sur la période.</p>
  const max = Math.max(1, maxImpose ?? Math.max(...donnees.map((d) => d.n)))
  return (
    <div className="barres">
      {donnees.map((d) => (
        <div className="barre" key={d.valeur}>
          <span className="lib" title={d.valeur}>{d.valeur}</span>
          <span className="piste"><b style={{ width: `${(d.n / max) * 100}%`, background: teinte }} /></span>
          <span className="v">{d.n}</span>
        </div>
      ))}
    </div>
  )
}

export function Entonnoir({ etapes }: { etapes: { etape: string; n: number }[] }) {
  const max = Math.max(1, ...etapes.map((e) => e.n))
  return (
    <div className="entonnoir">
      {etapes.map((e, i) => {
        const prec = i ? etapes[i - 1]!.n : null
        const taux = prec ? Math.round((e.n / prec) * 100) : null
        return (
          <div className="etape" key={e.etape}>
            <span className="lib">{e.etape}</span>
            <span className="piste"><b style={{ width: `${Math.max(2, (e.n / max) * 100)}%`, background: TEINTES[i % TEINTES.length] }} /></span>
            <span className="v">{e.n}{taux !== null && prec ? <small> {taux} %</small> : null}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Anneau({ parts, centre }: { parts: { nom: string; n: number; teinte?: string }[]; centre?: string }) {
  const total = parts.reduce((s, p) => s + p.n, 0)
  const r = 36
  const c = 2 * Math.PI * r
  let cumul = 0
  return (
    <div className="anneau">
      <svg viewBox="0 0 100 100" role="img" aria-label={parts.map((p) => `${p.nom} ${p.n}`).join(', ')}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {total > 0 && parts.map((p, i) => {
          const part = p.n / total
          const el = (
            <circle key={p.nom} cx="50" cy="50" r={r} fill="none" stroke={p.teinte ?? TEINTES[i % TEINTES.length]}
              strokeWidth="12" strokeDasharray={`${part * c} ${c}`} strokeDashoffset={-cumul * c} transform="rotate(-90 50 50)" />
          )
          cumul += part
          return el
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">{centre ?? total}</text>
      </svg>
      <ul>
        {parts.map((p, i) => (
          <li key={p.nom}><i style={{ background: p.teinte ?? TEINTES[i % TEINTES.length] }} />{p.nom} <b>{p.n}</b></li>
        ))}
      </ul>
    </div>
  )
}
