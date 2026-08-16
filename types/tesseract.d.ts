/**
 * tesseract.js is an *optional* dependency: OCR is off by default
 * (ENABLE_OCR=false) and the package pulls ~30MB of WASM. This minimal stub
 * lets the dynamic import typecheck; installing the real package
 * (`npm i tesseract.js`) supersedes it with full types.
 */
declare module 'tesseract.js' {
  export interface RecognizeResult {
    data: { text: string };
  }
  export interface Worker {
    recognize(image: Buffer | string): Promise<RecognizeResult>;
    terminate(): Promise<unknown>;
  }
  export function createWorker(lang?: string): Promise<Worker>;
}
