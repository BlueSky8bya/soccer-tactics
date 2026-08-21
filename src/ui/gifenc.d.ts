/** Minimal typings for gifenc (no official @types). Only what exportGif.ts uses. */
declare module 'gifenc' {
  export interface GifFrameOptions {
    /**
     * Supplying a palette on the FIRST frame writes the GLOBAL colour table; supplying it again on
     * later frames writes a LOCAL table per frame (768 bytes each, and a palette that can drift
     * frame to frame). One global table is both smaller and steadier — see exportGif.
     */
    palette?: number[][]
    /** Frame delay in MILLISECONDS (gifenc rounds it to centiseconds internally). */
    delay?: number
    transparent?: boolean
    transparentIndex?: number
    /** Loop count for the NETSCAPE extension; 0 = forever. Read on the first frame only. */
    repeat?: number
    dispose?: number
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifFrameOptions): void
    finish(): void
    reset(): void
    bytesView(): Uint8Array
  }
  export function GIFEncoder(opts?: {
    initialCapacity?: number
    auto?: boolean
  }): GifEncoderInstance
  export type QuantizeFormat = 'rgb565' | 'rgb444' | 'rgba4444'
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    opts?: { format?: QuantizeFormat; oneBitAlpha?: boolean; clearAlpha?: boolean },
  ): number[][]
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: QuantizeFormat,
  ): Uint8Array
}
