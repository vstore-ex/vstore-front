// Older HTML imports put whitespace inside closing ** delimiters, or split
// ** delimiters across lines. Repair only plain text in game descriptions;
// code, escaped markup and user reviews stay literal.
const oneLine = /(?<![\\*])\*\*(?!\*)([^\n*]*?\S)([ \t]+)\*\*(?!\*)/g
const crossLine = /(?<![\\*])\*\*(?!\*)\n([^*\n]*?\S)([ \t]*)(\n?)\*\*(?!\*)/g

function repairOneLine(value, result) {
  let start = 0
  for (const match of value.matchAll(oneLine)) {
    result.push({ type: 'text', value: value.slice(start, match.index) })
    const leading = match[1].match(/^[ \t]*/)[0]
    if (leading) result.push({ type: 'text', value: leading })
    result.push({ type: 'strong', children: [{ type: 'text', value: match[1].trim() }] })
    result.push({ type: 'text', value: match[2] })
    start = match.index + match[0].length
  }
  result.push({ type: 'text', value: value.slice(start) })
}

export default function importedDescription() {
  return (tree, file) => {
    const source = String(file)
    function visit(parent) {
      if (!parent.children) return
      parent.children = parent.children.flatMap((node) => {
        if (node.type !== 'text') {
          visit(node)
          return [node]
        }
        const raw = source.slice(node.position?.start.offset, node.position?.end.offset)
        if (raw !== node.value) return [node]
        const result = []
        let start = 0
        crossLine.lastIndex = 0
        for (const match of node.value.matchAll(crossLine)) {
          repairOneLine(node.value.slice(start, match.index), result)
          const leading = match[1].match(/^[ \t]*/)[0]
          if (leading) result.push({ type: 'text', value: leading })
          result.push({ type: 'strong', children: [{ type: 'text', value: match[1].trim() }] })
          const tail = match[2] + match[3]
          if (tail) result.push({ type: 'text', value: tail })
          start = match.index + match[0].length
        }
        repairOneLine(node.value.slice(start), result)
        return result.length === 1 && result[0].type === 'text' && result[0].value === node.value
          ? [node]
          : result
      })
    }
    visit(tree)
  }
}
