import type { Profil } from './types'

export type EtatSauvegarde = 'repos' | 'envoi' | 'ok' | 'erreur'

/** Une file par compte, indépendante des écrans. Le brouillon reste dans l'onglet. */
export class SauvegardeProfil {
  private attente: Profil | null = null
  private enCours: Promise<void> | null = null
  private delai: ReturnType<typeof setTimeout> | undefined
  private arretee = false
  private cle: string

  constructor(id: number, private enregistrer: (p: Profil) => Promise<unknown>,
    private etat: (e: EtatSauvegarde) => void) {
    this.cle = `aj.brouillon.${id}`
  }

  reprend(): Profil | null {
    try {
      const d = JSON.parse(sessionStorage.getItem(this.cle) ?? 'null')
      if (d?.version !== 1 || !d.profil || typeof d.profil.prenom !== 'string') return null
      for (const k of ['zones', 'contrats', 'metiers', 'metiersOpt', 'competences', 'competencesOpt', 'langues', 'experiences', 'formations']) {
        if (!Array.isArray(d.profil[k])) return null
      }
      return d.profil as Profil
    } catch { return null }
  }

  modifie(p: Profil): void {
    if (this.arretee) return
    this.attente = structuredClone(p)
    try { sessionStorage.setItem(this.cle, JSON.stringify({ version: 1, profil: this.attente })) } catch { /* le signal avant fermeture protège aussi ce cas */ }
    this.etat('envoi')
    clearTimeout(this.delai)
    this.delai = setTimeout(() => { void this.termine().catch(() => undefined) }, 800)
  }

  async termine(): Promise<void> {
    clearTimeout(this.delai)
    if (this.arretee) return
    if (this.enCours) return this.enCours
    this.enCours = (async () => {
      while (this.attente && !this.arretee) {
        const p = this.attente
        this.attente = null
        try { await this.enregistrer(p) } catch (e) {
          if (!this.attente) this.attente = p
          if (!this.arretee) this.etat('erreur')
          throw e
        }
      }
      if (!this.arretee) {
        try { sessionStorage.removeItem(this.cle) } catch { /* stockage indisponible */ }
        this.etat('ok')
      }
    })()
    try { await this.enCours } finally { this.enCours = null }
  }

  get enAttente(): boolean { return Boolean(this.attente || this.enCours) }

  arrete(): void {
    this.arretee = true
    clearTimeout(this.delai)
    // Un brouillon non envoyé reste récupérable à la reconnexion du même compte.
  }
}
