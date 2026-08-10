import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { getCardCatalog } from '../game/cards'
import {
  generatePack, generateSeededPack, loadCrystals, saveCrystals, CRYSTAL_PACK_COST,
} from '../game/collection'
import type { QuickBattleMode } from '../components/screens/QuickBattleScreen'
import type { Screen } from './screens'

interface UseShopFlowArgs {
  setScreen:   Dispatch<SetStateAction<Screen>>
  setCrystals: Dispatch<SetStateAction<number>>
  /** Which quick-battle mode the finished battle used — decides the reward pack. */
  quickBattleModeRef: MutableRefObject<QuickBattleMode>
  setQuickPlayRewardClaimed: Dispatch<SetStateAction<boolean>>
}

interface UseShopFlowResult {
  packs:  string[][]
  handleOpenPack:        () => void
  handleBuyCrystalPack:  (qty?: number, returnScreen?: Screen) => void
  handleCrystalsChanged: (n: number) => void
  handlePackDone:        () => void
}

/**
 * Pack opening and crystal purchases.
 *
 * `packBackScreenRef` lives here because nothing outside this flow reads it —
 * it only records where PackOpening should return to.
 */
export function useShopFlow({
  setScreen, setCrystals, quickBattleModeRef, setQuickPlayRewardClaimed,
}: UseShopFlowArgs): UseShopFlowResult {
  const packBackScreenRef = useRef<Screen>('title')
  const [packs, setPacks] = useState<string[][]>([])

  const handleOpenPack = useCallback(() => {
    packBackScreenRef.current = 'playing'
    setQuickPlayRewardClaimed(true)
    let pack: string[]

    switch(quickBattleModeRef.current) {
      case 'easy':
        pack = [...new Set(generatePack())].slice(0, 2)
        break
      case 'normal':
      case 'mirror':
      case 'draft':
        pack = generatePack()
        break
      case 'unlimited':
        pack = generateSeededPack(3, 'rare')
        break
      case 'hero-only':
        pack = generateSeededPack(5, 'legendary')
        break
      case 'chaos':
        pack = generateSeededPack(2, 'legendary')
        break
      case 'only-units': {
        const pool = getCardCatalog().filter(c => c.cardType.includes('unit'))
        pack = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'only-spells': {
        const pool = getCardCatalog().filter(c => c.cardType.includes('upgrade'))
        pack = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'only-buildings': {
        const pool = getCardCatalog().filter(c => c.cardType.includes('structure'))
        pack = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'common-only': {
        const pool = getCardCatalog().filter(c => c.rarity === 'common')
        pack = Array.from({ length: 5 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'uncommon-only':
        pack = generateSeededPack(5, 'uncommon')
        break
      case 'rare-only':
        pack = generateSeededPack(5, 'rare')
        break
      case 'legendary-only':
        pack = generateSeededPack(5, 'legendary')
        break
      default:
        pack = generatePack()
        break
    }

    setPacks([pack])
    setScreen('pack')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBuyCrystalPack = useCallback((qty: number = 1, returnScreen: Screen = 'shop') => {
    const current = loadCrystals()
    const totalCost = CRYSTAL_PACK_COST * qty
    if (current < totalCost) return
    const next = current - totalCost
    saveCrystals(next)
    setCrystals(next)
    packBackScreenRef.current = returnScreen
    setPacks(Array.from({ length: qty }, () => generatePack()))
    setScreen('pack')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCrystalsChanged = useCallback((n: number) => {
    setCrystals(n)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePackDone = useCallback(() => {
    setScreen(packBackScreenRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { packs, handleOpenPack, handleBuyCrystalPack, handleCrystalsChanged, handlePackDone }
}
