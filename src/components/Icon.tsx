/**
 * Single icon family: lucide outlines, forced to 1.5px stroke, round joins.
 * Default box is 20px, matching the reference kit's icon grid (a 20px box holding a
 * ~16px glyph). Pass `size` where a screen needs a larger or smaller one.
 * Icons are imported explicitly (tree-shaken). Add to ICONS when a screen needs a new one.
 * Usage: <Icon name="arrow-up-right" />
 */
import { forwardRef, type SVGProps } from 'react'
import {
  ArrowDownLeft, ArrowDownToLine, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpFromLine, ArrowUpRight, Banknote, Bell, BellOff, Building2, Calendar, CalendarClock, Camera, ChartCandlestick, ChartLine, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert, CircleCheck, CirclePlus, CircleUserRound, CircleX, Clock, CloudOff, Coins, Copy, CreditCard, Delete, Download, ExternalLink, Eye, EyeOff, FileSignature, FileText, Filter, Fingerprint, Flag, Gem, Gift, Globe, HelpCircle, House, Info, Landmark, Languages, Link2, Lock, LockKeyhole, LogOut, Mail, MessageCircle, Minus, Monitor, Moon, MoreHorizontal, Pencil, PiggyBank, Plus, QrCode, Receipt, Repeat, RotateCw, Scan, ScanFace, Search, Send, Settings, Share2, Shield, ShieldCheck, Smartphone, Snowflake, Split, Star, StarOff, Sun, Sunrise, Target, ThumbsDown, ThumbsUp, Trash2, TrendingDown, TrendingUp, TriangleAlert, Upload, User, Users, Wallet, WifiOff, X,
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
  'chart-candle': ChartCandlestick,
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

  /* ---- Semantic names, from the reference kit's icon set ----
     The kit draws filled glyphs; these are the nearest outline equivalents. Prefer a
     semantic name over a generic arrow at a call site: it says what the action means,
     and it survives a later change of glyph. */
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  recurring: Repeat,
  automated: Repeat,
  schedule: CalendarClock,
  cheque: Banknote,
  money: Banknote,
  wire: Landmark,
  'bank-draft': FileSignature,
  'sign-doc': FileSignature,
  crypto: Coins,
  invest: TrendingUp,
  increase: TrendingUp,
  split: Split,
  'face-id': ScanFace,
  warning: TriangleAlert,
  cancel: CircleX,
  'plus-circle': CirclePlus,
  'checkmark-filled': CircleCheck,
  'new-tab': ExternalLink,
  share: Share2,
  'double-user': Users,
  diamond: Gem,
  chat: MessageCircle,
  gift: Gift,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  premarket: Sunrise,
  'after-hours': Moon,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'name'> {
  name: IconName
  size?: number
  /** Decorative by default. Pass a label to make it meaningful. */
  label?: string
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ name, label, size = 20, ...rest }, ref) {
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
