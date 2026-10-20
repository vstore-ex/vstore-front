const labels = {
  os: 'OS version',
  os_version: 'OS version',
  cpu: 'Processor',
  processor: 'Processor',
  ram: 'Memory',
  memory: 'Memory',
  gpu: 'Graphics',
  graphics: 'Graphics',
  directx: 'DirectX',
  storage: 'Storage',
  network: 'Network',
  additional_notes: 'Additional notes',
}
const label = (key) =>
  labels[key.toLowerCase()] || key.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase())
function rows(value, prefix = '', depth = 0) {
  if (depth > 5 || value == null) return []
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim()
    return text ? [{ label: prefix, text }] : []
  }
  if (Array.isArray(value)) return value.flatMap((item) => rows(item, prefix, depth + 1))
  if (typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) =>
    rows(item, [prefix, label(key)].filter(Boolean).join(' / '), depth + 1),
  )
}
export function parseRequirements(value) {
  let source = value
  if (typeof source === 'string') {
    source = source.trim()
    if (!source) return { sections: [] }
    if (/^[{["]/.test(source)) {
      try {
        source = JSON.parse(source)
        if (typeof source === 'string' && /^[{[]/.test(source.trim())) source = JSON.parse(source)
      } catch {
        return { sections: [] }
      }
    } else return { markdown: source, sections: [] }
  }
  if (!source || typeof source !== 'object') return { sections: [] }
  const split = !Array.isArray(source) && ('minimum' in source || 'recommended' in source)
  const sections = split
    ? ['minimum', 'recommended'].map((key) => ({ title: label(key), rows: rows(source[key]) }))
    : [{ title: '', rows: rows(source) }]
  return { sections: sections.filter((section) => section.rows.length) }
}
