import { describe, it, expect } from 'vitest'
import { BMI_CATS, bmiCategory, calcBMI, pctOfBodyweight } from '../stats'

describe('calcBMI', () => {
  it('computes weight / height² with height in cm', () => {
    // 70 kg at 175 cm → 70 / 1.75² = 22.857…
    expect(calcBMI(70, 175)).toBeCloseTo(22.857, 3)
    expect(calcBMI(100, 200)).toBe(25)
  })

  it('returns null when either input is missing or non-positive', () => {
    expect(calcBMI(0, 175)).toBe(null)
    expect(calcBMI(70, 0)).toBe(null)
    expect(calcBMI(null, 175)).toBe(null)
    expect(calcBMI(70, null)).toBe(null)
    expect(calcBMI(undefined, undefined)).toBe(null)
    expect(calcBMI(-70, 175)).toBe(null)
    expect(calcBMI(70, -175)).toBe(null)
  })
})

describe('bmiCategory', () => {
  it('labels each band', () => {
    expect(bmiCategory(17).label).toBe('Underweight')
    expect(bmiCategory(22).label).toBe('Healthy')
    expect(bmiCategory(27).label).toBe('Overweight')
    expect(bmiCategory(35).label).toBe('Obese')
  })

  it('treats each boundary as exclusive — the band starts at its threshold', () => {
    expect(bmiCategory(18.4).label).toBe('Underweight')
    expect(bmiCategory(18.5).label).toBe('Healthy')
    expect(bmiCategory(24.9).label).toBe('Healthy')
    expect(bmiCategory(25).label).toBe('Overweight')
    expect(bmiCategory(29.9).label).toBe('Overweight')
    expect(bmiCategory(30).label).toBe('Obese')
  })

  it('always returns a category, including at the extremes', () => {
    expect(bmiCategory(0).label).toBe('Underweight')
    expect(bmiCategory(1000).label).toBe('Obese')
    expect(bmiCategory(Infinity).label).toBe('Obese')
  })

  it('returns a band carrying the colours the UI renders', () => {
    var cat = bmiCategory(22)
    expect(cat.color).toBe('#2a9d5c')
    expect(cat.bg).toBe('#edfaf2')
  })
})

describe('BMI_CATS', () => {
  it('is ordered ascending and open-ended at the top', () => {
    for (var i = 1; i < BMI_CATS.length; i++) {
      expect(BMI_CATS[i].max).toBeGreaterThan(BMI_CATS[i - 1].max)
    }
    expect(BMI_CATS[BMI_CATS.length - 1].max).toBe(Infinity)
  })
})

describe('pctOfBodyweight', () => {
  it('takes the difference as a share of the current weight', () => {
    expect(pctOfBodyweight(1.8, 80.8)).toBe(2.2)
    expect(pctOfBodyweight(5, 100)).toBe(5)
  })

  it('is the point of the figure: the same kg at two body sizes', () => {
    // 1.8 kg is nearly twice the ask at 60 kg that it is at 110.
    expect(pctOfBodyweight(1.8, 60)).toBe(3)
    expect(pctOfBodyweight(1.8, 110)).toBe(1.6)
  })

  it('drops the sign, because the label around it says lose or gain', () => {
    expect(pctOfBodyweight(-2, 80)).toBe(2.5)
    expect(pctOfBodyweight(2, 80)).toBe(2.5)
  })

  it('returns null rather than a nonsense percentage', () => {
    expect(pctOfBodyweight(2, 0)).toBe(null)
    expect(pctOfBodyweight(2, null)).toBe(null)
    expect(pctOfBodyweight(2, -80)).toBe(null)
    expect(pctOfBodyweight(null, 80)).toBe(null)
    expect(pctOfBodyweight('heavy', 80)).toBe(null)
    expect(pctOfBodyweight(2, undefined)).toBe(null)
  })

  it('rounds to one decimal', () => {
    expect(pctOfBodyweight(1, 3)).toBe(33.3)
    expect(pctOfBodyweight(0.05, 100)).toBe(0.1)
  })
})
