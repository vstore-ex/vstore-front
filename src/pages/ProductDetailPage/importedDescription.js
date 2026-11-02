// Older HTML imports put whitespace inside closing ** delimiters. Repair only
// plain text in game descriptions; code, escaped markup and user reviews stay literal.
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
        const pattern = /(?<![\\*])\*\*(?!\*)([^\n*]*?\S)([ \t]+)\*\*(?!\*)/g
        const result = []
        let start = 0
        for (const match of node.value.matchAll(pattern)) {
          result.push({ type: 'text', value: node.value.slice(start, match.index) })
          const leading = match[1].match(/^[ \t]*/)[0]
          if (leading) result.push({ type: 'text', value: leading })
          result.push({ type: 'strong', children: [{ type: 'text', value: match[1].trim() }] })
          result.push({ type: 'text', value: match[2] })
          start = match.index + match[0].length
        }
        if (!result.length) return [node]
        result.push({ type: 'text', value: node.value.slice(start) })
        return result
      })
    }
    visit(tree)
  }
}
