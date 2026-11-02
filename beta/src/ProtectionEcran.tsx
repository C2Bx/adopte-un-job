import { Component } from 'react'
import type { ReactNode } from 'react'

/** Une erreur d'affichage ne doit pas laisser le candidat devant une page blanche. */
export class ProtectionEcran extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false }
  static getDerivedStateFromError() { return { erreur: true } }
  render() {
    return this.state.erreur ? <main className="chargement" role="alert"><h1>Cet écran n’a pas pu être affiché</h1>
      <p>Recharge la page pour réessayer. Un envoi n’est pas confirmé par ce message ; consulte tes candidatures après reconnexion.</p>
      <button className="btn primaire" onClick={() => location.reload()}>Recharger</button></main> : this.props.children
  }
}
