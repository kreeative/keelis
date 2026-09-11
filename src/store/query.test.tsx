import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearQueryCache, invalidate, setQueryData, useQuery } from './query'

function Probe({ fetcher }: { fetcher: () => Promise<string> }) {
  const q = useQuery('probe', fetcher)
  return (
    <div>
      <span data-testid="data">{q.data ?? 'vide'}</span>
      <span data-testid="loading">{q.loading ? 'oui' : 'non'}</span>
      <span data-testid="error">{q.error?.message ?? '—'}</span>
    </div>
  )
}

beforeEach(() => clearQueryCache())

describe('useQuery', () => {
  it('re-renders when the fetch settles', async () => {
    let resolve: (v: string) => void = () => {}
    render(<Probe fetcher={() => new Promise<string>((r) => (resolve = r))} />)
    expect(screen.getByTestId('loading').textContent).toBe('oui')
    await act(async () => {
      resolve('42 $')
    })
    expect(screen.getByTestId('data').textContent).toBe('42 $')
    expect(screen.getByTestId('loading').textContent).toBe('non')
  })

  it('re-renders when the cache is patched optimistically', async () => {
    render(<Probe fetcher={() => Promise.resolve('un')} />)
    await act(async () => {})
    expect(screen.getByTestId('data').textContent).toBe('un')
    await act(async () => {
      setQueryData<string>('probe', () => 'deux')
    })
    expect(screen.getByTestId('data').textContent).toBe('deux')
  })

  it('keeps the cached value while refetching and surfaces errors', async () => {
    let call = 0
    render(
      <Probe
        fetcher={() => {
          call += 1
          return call === 1 ? Promise.resolve('cache') : Promise.reject(new Error('réseau'))
        }}
      />,
    )
    await act(async () => {})
    expect(screen.getByTestId('data').textContent).toBe('cache')
    await act(async () => {
      invalidate('probe')
    })
    expect(screen.getByTestId('data').textContent).toBe('cache')
    expect(screen.getByTestId('error').textContent).toBe('réseau')
  })
})
