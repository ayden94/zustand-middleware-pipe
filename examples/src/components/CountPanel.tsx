interface CountPanelProps {
  compact?: boolean
  label: string
  value: number
}

export function CountPanel({ compact = false, label, value }: CountPanelProps) {
  return (
    <div className={compact ? 'count-panel compact' : 'count-panel'}>
      <span className="count-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
