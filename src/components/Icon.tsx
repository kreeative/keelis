/**
 * Single icon family: lucide outlines, forced to 1.5px stroke, 24px, round joins.
 * Icons are imported explicitly (tree-shaken). Add to ICONS when a screen needs a new one.
 * Usage: <Icon name="arrow-up-right" />
 */
import { forwardRef, type SVGProps } from 'react'
import {
  ArrowDownLeft, ArrowDownToLine, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpFromLine, ArrowUpRight, Banknote, Bell, BellOff, Building2, Calendar, Camera, ChartLine, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert, CircleUserRound, Clock, CloudOff, Copy, CreditCard, Delete, Download, Eye, EyeOff, FileText, Filter, Fingerprint, Flag, Globe, HelpCircle, House, Info, Landmark, Languages, Link2, Lock, LockKeyhole, LogOut, Mail, Minus, Monitor, Moon, MoreHorizontal, Pencil, PiggyBank, Plus, QrCode, Receipt, Repeat, RotateCw, Scan, Search, Send, Settings, Shield, ShieldCheck, Smartphone, Snowflake, Star, StarOff, Sun, Target, Trash2, TrendingDown, TrendingUp, Upload, User, Wallet, WifiOff, X,
  type LucideIcon,
} from 'lucide-react'

export const ICONS = {
  'arrow-down-left': ArrowDownLeft,
  'arrow-down-to-line': ArrowDownToLine,
  'arrow-left': ArrowLeft,
  'arrow-left-right': ArrowLeftRight,
  'arrow-right': ArrowRight,
  'arrow-up-from-line': ArrowUpFromLine,
  'arrow-up-right': ArrowUpRight,
  banknote: Banknote,
  bell: Bell,
  'bell-off': BellOff,
  'building-2': Building2,
  calendar: Calendar,
  camera: Camera,
  'chart-line': ChartLine,
  check: Check,
  'check-circle-2': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  circle: Circle,
  'circle-alert': CircleAlert,
  'circle-user-round': CircleUserRound,
  clock: Clock,
  'cloud-off': CloudOff,
  copy: Copy,
  'credit-card': CreditCard,
  delete: Delete,
  download: Download,
  eye: Eye,
  'eye-off': EyeOff,
  'file-text': FileText,
  filter: Filter,
  fingerprint: Fingerprint,
  flag: Flag,
  globe: Globe,
  'help-circle': HelpCircle,
  house: House,
  info: Info,
  landmark: Landmark,
  languages: Languages,
  'link-2': Link2,
  lock: Lock,
  'lock-keyhole': LockKeyhole,
  'log-out': LogOut,
  mail: Mail,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  'more-horizontal': MoreHorizontal,
  pencil: Pencil,
  'piggy-bank': PiggyBank,
  plus: Plus,
  'qr-code': QrCode,
  receipt: Receipt,
  repeat: Repeat,
  'rotate-cw': RotateCw,
  scan: Scan,
  search: Search,
  send: Send,
  settings: Settings,
  shield: Shield,
  'shield-check': ShieldCheck,
  smartphone: Smartphone,
  snowflake: Snowflake,
  star: Star,
  'star-off': StarOff,
  sun: Sun,
  target: Target,
  'trash-2': Trash2,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  upload: Upload,
  user: User,
  wallet: Wallet,
  'wifi-off': WifiOff,
  x: X,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'name'> {
  name: IconName
  size?: number
  /** Decorative by default. Pass a label to make it meaningful. */
  label?: string
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ name, label, size = 24, ...rest }, ref) {
  const Cmp = ICONS[name] ?? Circle
  return (
    <Cmp
      ref={ref}
      size={size}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    />
  )
})
