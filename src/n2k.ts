import {
  CMD_SELECT_PRESET,
  PRODUCT_ID,
  UNK1,
  UNK2,
  PGN_SINGLE,
  DEFAULT_SRC,
  DEFAULT_DST,
  DEFAULT_PRIO,
} from './protocol'

export interface PgnMessage {
  pgn: number
  dst: number
  prio: number
  src: number
  [key: string]: any
}

export function buildSelectPreset(index: number, src: number = DEFAULT_SRC): PgnMessage {
  if (!Number.isInteger(index) || index < 0 || index > 3) {
    throw new Error(`Preset index must be 0-3, got ${index}`)
  }
  return {
    pgn: PGN_SINGLE,
    dst: DEFAULT_DST,
    prio: DEFAULT_PRIO,
    src,
    'Manufacturer Code': 229,
    'Industry Code': 4,
    'Command': CMD_SELECT_PRESET,
    'Product ID': PRODUCT_ID,
    'Unknown 1': UNK1,
    'Unknown 2': UNK2,
    'Preset Index': index
  }
}
