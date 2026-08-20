/** Minimal typings for gifenc (no official @types). Only what exportGif.ts uses. */
declare module 'gifenc' {
  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][]; delay?: number; transparent?: boolean },
    ): void
    finish(): void
    bytesView(): Uint8Array
  }
  export function GIFEncoder(): GifEncoderInstance
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number): number[][]
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
  ): Uint8Array
}
