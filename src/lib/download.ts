/**
 * Hand a document to the browser.
 *
 * Trivial, and it exists so that nothing has to fake it. The statements and tax slips used
 * to be wired to a button that showed « téléchargement lancé » and downloaded nothing —
 * the same shape of claim the conversion screen made about money. A screen may say a
 * document is unavailable; it may not say it sent one.
 *
 * `noopener` because the URL comes from the back-end: a signed link to object storage
 * should not get a handle on the window that opened it.
 */
export function download(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
