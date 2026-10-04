// Data files refer to icons by name; this map keeps the bundle to the icons we use.
import {
  Zap, Wrench, Flame, Car, Monitor, Sun, HeartPulse, Scissors, Snowflake,
  IndianRupee, BriefcaseBusiness, Users, ShieldCheck, MapPin, Wallet, HeartHandshake, GraduationCap,
  UserRound, Backpack,
} from 'lucide-react'

const MAP = {
  Zap, Wrench, Flame, Car, Monitor, Sun, HeartPulse, Scissors, Snowflake,
  IndianRupee, BriefcaseBusiness, Users, ShieldCheck, MapPin, Wallet, HeartHandshake, GraduationCap,
  UserRound, Backpack,
}

export default function Icon({ name, size = 20, ...rest }) {
  const C = MAP[name] ?? UserRound
  return <C size={size} aria-hidden="true" {...rest} />
}
