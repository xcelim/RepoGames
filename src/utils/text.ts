// Quita tildes ("Pokémon" -> "Pokemon") aunque el motor no soporte normalize.
export function stripAccents(text: string): string {
  try {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    return text;
  }
}

export function slugify(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Para comparar títulos: sin tildes, sin mayúsculas, sin símbolos.
export function normTitle(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
