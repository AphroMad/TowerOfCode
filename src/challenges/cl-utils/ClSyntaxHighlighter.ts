/**
 * Lightweight Python syntax highlighter for inline code snippets.
 * Produces one-dark-themed colored spans.
 */

const KEYWORDS = new Set([
  'if', 'else', 'elif', 'for', 'while', 'def', 'class', 'return',
  'import', 'from', 'as', 'try', 'except', 'finally', 'with',
  'yield', 'lambda', 'pass', 'break', 'continue', 'raise', 'in',
  'not', 'and', 'or', 'is', 'None', 'True', 'False', 'del',
  'global', 'nonlocal', 'assert',
])

const BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'list', 'dict',
  'set', 'tuple', 'type', 'input', 'open', 'map', 'filter', 'zip',
  'enumerate', 'sorted', 'reversed', 'abs', 'max', 'min', 'sum',
  'bool', 'isinstance', 'hasattr', 'getattr', 'setattr', 'super',
  'round', 'hex', 'bin', 'oct', 'chr', 'ord', 'format',
])

const C = {
  keyword: '#c678dd',
  builtin: '#61afef',
  string: '#98c379',
  number: '#d19a66',
  operator: '#56b6c2',
  default: '#abb2bf',
  paren: '#abb2bf',
  comment: '#5c6370',
} as const

export function escapeHtml(s: string): string {
  const el = document.createElement('span')
  el.textContent = s
  return el.innerHTML
}

/**
 * Replaces `code text` with syntax-colored <code> elements.
 * Input should already be HTML-escaped except for backtick pairs.
 */
export function highlightInlineCode(html: string): string {
  return html.replace(/`([^`]+)`/g, (_match, code: string) => {
    return `<code>${tokenizePython(code)}</code>`
  })
}

/** Lightweight Python tokenizer producing one-dark colored spans */
export function tokenizePython(code: string): string {
  let result = ''
  let i = 0
  while (i < code.length) {
    // Comments
    if (code[i] === '#') {
      const rest = escapeHtml(code.slice(i))
      result += `<span style="color:${C.comment}">${rest}</span>`
      break
    }
    // Strings (single/double quote)
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i]
      let j = i + 1
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++ // skip escaped
        j++
      }
      j++ // include closing quote
      const token = escapeHtml(code.slice(i, j))
      result += `<span style="color:${C.string}">${token}</span>`
      i = j
      continue
    }
    // f-string prefix
    if (code[i] === 'f' && i + 1 < code.length && (code[i + 1] === '"' || code[i + 1] === "'")) {
      const quote = code[i + 1]
      let j = i + 2
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++
        j++
      }
      j++
      const token = escapeHtml(code.slice(i, j))
      result += `<span style="color:${C.string}">${token}</span>`
      i = j
      continue
    }
    // Numbers
    if (/\d/.test(code[i])) {
      let j = i
      while (j < code.length && /[\d._]/.test(code[j])) j++
      const token = escapeHtml(code.slice(i, j))
      result += `<span style="color:${C.number}">${token}</span>`
      i = j
      continue
    }
    // Words (identifiers / keywords / builtins)
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++
      const word = code.slice(i, j)
      const escaped = escapeHtml(word)
      if (KEYWORDS.has(word)) {
        result += `<span style="color:${C.keyword}">${escaped}</span>`
      } else if (BUILTINS.has(word)) {
        result += `<span style="color:${C.builtin}">${escaped}</span>`
      } else {
        result += `<span style="color:${C.default}">${escaped}</span>`
      }
      i = j
      continue
    }
    // Operators
    if ('=+-*/<>!%&|^~'.includes(code[i])) {
      result += `<span style="color:${C.operator}">${escapeHtml(code[i])}</span>`
      i++
      continue
    }
    // Parens, brackets, dots, commas
    result += `<span style="color:${C.paren}">${escapeHtml(code[i])}</span>`
    i++
  }
  return result
}
