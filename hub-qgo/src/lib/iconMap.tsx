import * as LucideIcons from "lucide-react";
import { AppWindow, type LucideIcon } from "lucide-react";

// As ferramentas guardam o ícone como texto (ex.: "ClipboardList") pra poder
// ser escolhido/editado na tela de administração sem precisar mexer em
// código. Isso resolve esse texto pro componente de ícone de verdade, com
// "AppWindow" como reserva se o nome não existir na biblioteca.
export function getToolIcon(nome: string): LucideIcon {
  const icones = LucideIcons as unknown as Record<string, LucideIcon>;
  return icones[nome] ?? AppWindow;
}
