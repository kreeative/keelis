import { useCallback } from 'react'
import { useNavigationType } from 'react-router-dom'

/**
 * Focus the first input of a step when the person walks into it (a real
 * navigation), never on a cold load or a redirect: stealing focus on arrival
 * opens the keyboard and pushes the question out of view.
 */
export function useStepFocus() {
  const type = useNavigationType()
  return useCallback(
    (el: HTMLInputElement | null) => {
      if (el && type === 'PUSH') el.focus({ preventScroll: true })
    },
    [type],
  )
}
