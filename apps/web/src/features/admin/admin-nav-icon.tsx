import {
  Activity,
  Banknote,
  Bell,
  ClipboardList,
  Gamepad2,
  Gauge,
  LifeBuoy,
  Network,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Swords,
  Trophy,
  UserRoundCog,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

const iconByHref: Readonly<Record<string, LucideIcon>> = {
  '/admin': Gauge,
  '/admin/search': Search,
  '/admin/users': Users,
  '/admin/audit': ClipboardList,
  '/admin/diagnostics': Activity,
  '/admin/notifications': Bell,
  '/admin/support': LifeBuoy,
  '/admin/game-accounts': Gamepad2,
  '/admin/matches': Swords,
  '/admin/matchmaking': Network,
  '/admin/results': Trophy,
  '/admin/ratings': Star,
  '/admin/disputes': Scale,
  '/admin/wallets': WalletCards,
  '/admin/finance': Banknote,
  '/admin/settlements': ReceiptText,
  '/admin/operators': UserRoundCog,
};

export function AdminNavIcon({ href }: { href: string }) {
  const Icon = iconByHref[href] ?? ShieldCheck;

  return <Icon aria-hidden="true" focusable="false" size={18} strokeWidth={1.8} />;
}
