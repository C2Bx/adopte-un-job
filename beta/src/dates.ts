/** Les anciennes dates sans fuseau viennent de l'API en UTC ; les ISO gardent leur fuseau. */
export function dateApi(quand: string): number {
  const iso = quand.replace(' ', 'T')
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`)
}
