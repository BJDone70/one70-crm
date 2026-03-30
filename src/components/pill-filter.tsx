'use client'

interface PillOption {
  id: string
  label: string
  icon?: string
}

interface SingleProps {
  options: PillOption[]
  value: string
  onChange: (value: string) => void
  allowDeselect?: boolean
  multi?: false
}

interface MultiProps {
  options: PillOption[]
  value: string[]
  onChange: (value: string[]) => void
  allowDeselect?: boolean
  multi: true
}

type PillFilterProps = SingleProps | MultiProps

export default function PillFilter(props: PillFilterProps) {
  const { options, allowDeselect = true } = props
  const isMulti = props.multi === true

  const selectedArr: string[] = isMulti ? (props.value as string[]) : [(props.value as string)]

  function handleTap(optionId: string) {
    if (isMulti) {
      const onChange = props.onChange as (v: string[]) => void
      if (selectedArr.includes(optionId)) {
        const next = selectedArr.filter(v => v !== optionId)
        onChange(next.length > 0 ? next : ['all'])
      } else {
        // If selecting 'all', clear other selections
        if (optionId === 'all') { onChange(['all']); return }
        const next = [...selectedArr.filter(v => v !== 'all'), optionId]
        onChange(next)
      }
    } else {
      const onChange = props.onChange as (v: string) => void
      if (allowDeselect && props.value === optionId) onChange('all')
      else onChange(optionId)
    }
  }

  // Use dropdown when many options
  if (options.length > 8) {
    if (isMulti) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedArr.filter(v => v !== 'all').map(v => {
            const opt = options.find(o => o.id === v)
            return opt ? (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-one70-black text-white rounded-full text-[10px] font-medium">
                {opt.label}
                <button onClick={() => handleTap(v)} className="hover:text-red-300">×</button>
              </span>
            ) : null
          })}
          <select value="" onChange={e => { if (e.target.value) handleTap(e.target.value) }}
            className="text-xs border border-one70-border rounded-md px-2 py-1 bg-white text-one70-dark">
            <option value="">Filter...</option>
            {options.filter(o => o.id !== 'all' && !selectedArr.includes(o.id)).map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {selectedArr.some(v => v !== 'all') && (
            <button onClick={() => (props.onChange as (v: string[]) => void)(['all'])}
              className="text-[10px] text-one70-mid hover:text-red-500 px-1">Clear</button>
          )}
        </div>
      )
    }
    return (
      <select value={props.value as string} onChange={e => (props.onChange as (v: string) => void)(e.target.value)}
        className="text-xs border border-one70-border rounded-md px-2 py-1.5 bg-white text-one70-dark focus:outline-none focus:border-one70-black">
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.icon ? `${opt.icon} ` : ''}{opt.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
      {options.map(opt => {
        const active = selectedArr.includes(opt.id)
        return (
          <button
            key={opt.id}
            onClick={() => handleTap(opt.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              active
                ? 'bg-one70-black text-white border-one70-black'
                : 'bg-white text-one70-dark border-one70-border hover:border-one70-dark'
            }`}
          >
            {opt.icon && <span className="mr-1">{opt.icon}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
