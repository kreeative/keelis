import styles from './AmbientGround.module.css'

/**
 * The colour field the glass surfaces refract. A single fixed, non-interactive layer
 * painted once behind the app — cheaper and far steadier on mobile than
 * `background-attachment: fixed`, which repaints the gradient on every scroll frame.
 * Mount once at the app root.
 */
export function AmbientGround() {
  return <div className={styles.ground} aria-hidden="true" />
}
