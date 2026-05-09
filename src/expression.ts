import { ExprNode } from './parser'

export function evaluate(
  node: ExprNode,
  getPathValue: (path: string) => unknown,
  previouslyActive?: boolean
): boolean {
  switch (node.kind) {
    case 'and':
      return evaluate(node.left, getPathValue, previouslyActive)
          && evaluate(node.right, getPathValue, previouslyActive)
    case 'or':
      return evaluate(node.left, getPathValue, previouslyActive)
          || evaluate(node.right, getPathValue, previouslyActive)
    case 'not':
      return !evaluate(node.child, getPathValue, previouslyActive)

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
      return v > node.value
    }
    case 'lt': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v < node.value
    }
    case 'gte': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v >= node.value
    }
    case 'lte': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      return v <= node.value
    }

    case 'between': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      // Hysteresis widens the accepted range, but only while this preset is already active,
      // so the threshold to *enter* is strict and the threshold to *leave* is sticky.
      const h = previouslyActive && node.hysteresis ? node.hysteresis : 0
      return v >= node.min - h && v <= node.max + h
    }
    case 'outside': {
      const v = getPathValue(node.path)
      if (typeof v !== 'number') return false
      // Hysteresis narrows the inner "dead zone" while active, making "outside" sticky.
      const h = previouslyActive && node.hysteresis ? node.hysteresis : 0
      return v < node.min + h || v > node.max - h
    }

    default:
      return false
  }
}
