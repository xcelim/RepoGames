// En el móvil las tipografías van metidas dentro de la app (plugin expo-font en app.json),
// así Android mide el texto con la letra correcta desde el primer momento y no se corta.
export async function loadFonts(_names: string[]): Promise<void> {}

export function fontsLoaded(_names: string[]): boolean {
  return true;
}

export function loadAllFonts(): Promise<void> {
  return Promise.resolve();
}
