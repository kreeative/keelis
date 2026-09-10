/**
 * Mobile: bottom bar, 5 tabs. Desktop (≥768px): 240px side rail.
 */
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Wordmark } from './Wordmark'
import styles from './NavBar.module.css'

export const NAV_ITEMS = [
  { to: '/', label: 'Accueil', icon: 'house' as const, end: true },
  { to: '/crypto', label: 'Crypto', icon: 'chart-line' as const, end: false },
  { to: '/carte', label: 'Carte', icon: 'credit-card' as const, end: false },
  { to: '/epargne', label: 'Épargne', icon: 'piggy-bank' as const, end: false },
  { to: '/profil', label: 'Profil', icon: 'circle-user-round' as const, end: false },
] as const

export function NavBar({ unread = 0 }: { unread?: number }) {
  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      <div className={styles.brand}>
        <Wordmark />
      </div>
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(styles.link, isActive && styles.active)}>
              <span className={styles.iconWrap}>
                <Icon name={item.icon} />
                {item.to === '/profil' && unread > 0 ? <span className={styles.dot} aria-hidden="true" /> : null}
              </span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
