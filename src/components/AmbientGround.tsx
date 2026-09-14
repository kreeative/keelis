import styles from './AmbientGround.module.css'

/**
 * The page's ground: one flat colour, on a single fixed layer behind the app.
 *
 * It was four overlapping radial fields, there to give the translucent surfaces something
 * to refract. The surfaces are plain now and the fields only showed between the cards, so
 * what is left is the colour. It stays a fixed layer rather than moving to `body` because
 * `body` is transparent on purpose throughout the app, and one element that owns the ground
 * is easier to reason about than a rule three files away.
 */
export function AmbientGround() {
  return <div className={styles.ground} aria-hidden="true" />
}
