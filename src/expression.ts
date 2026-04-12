import { ExprNode } from './parser'

export function evaluate(
  node: ExprNode,
  getPathValue: (path: string) => unknown,
  hysteresis?: number,
  previouslyActive?: boolean
): boolean {
  const h = previouslyActive && hysteresis ? hysteresis : 0

  switch (node.kind) {
    case 'and':
      return evaluate(node.left, getPathValue, hysteresis, previouslyActive)
          && evaluate(node.right, getPathValue, hysteresis, previouslyActive)
    case 'or':
      return evaluate(node.left, getPathValue, hysteresis, previouslyActive)
          || evaluate(node.right, getPathValue, hysteresis, previouslyActive)
    case 'not':
      return !evaluate(node.child, getPathValue, hysteresis, previouslyActive)

    case 'true':
      return true
    case 'false':
      return false

    case 'eq': {
      const v = getPathValue(node.path)
      if (v === undefined || v === null) return false
      return v === node.value
    }
    case 'neq': {
      const v = getPathValue(node.path)
      if (v === undefined || v === null) return false
      return v !== node.value
    }

    case 'gt': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v > node.value - h
    }
    case 'lt': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v < node.value + h
    }
    case 'gte': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v >= node.value - h
    }
    case 'lte': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v <= node.value + h
    }

    case 'between': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v >= node.min - h && v <= node.max + h
    }
    case 'outside': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v < node.min + h || v > node.max - h
    }

    default:
      return false
  }
}
