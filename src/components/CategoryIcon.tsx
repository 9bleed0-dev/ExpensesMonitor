import {
  Car, Dumbbell, Droplet, Ellipsis, Flame, Fuel, Gift, GraduationCap, HeartPulse, House, Landmark, PawPrint,
  PiggyBank, Plane, Receipt, Shield, Shirt, ShoppingCart, Smartphone, Sparkles, Tv, Utensils, Wallet, Wifi, Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '../db'

export const ICONS: Record<string, LucideIcon> = {
  Zap, House, ShoppingCart, Car, Utensils, Tv, HeartPulse, Shield, Sparkles, Landmark, Ellipsis, Flame, Droplet,
  Wifi, Smartphone, Fuel, Plane, Gift, GraduationCap, Shirt, Dumbbell, PawPrint, PiggyBank, Receipt, Wallet,
}

export function CategoryIcon({ category, size = 40 }: { category?: Category; size?: number }) {
  const Icon = ICONS[category?.icon ?? 'Ellipsis'] ?? Ellipsis
  const color = category?.color ?? '#94a3b8'
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, background: `${color}26`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <Icon size={size * 0.48} strokeWidth={2.2} />
    </span>
  )
}
