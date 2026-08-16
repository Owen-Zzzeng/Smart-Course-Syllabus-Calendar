import { env } from './env';

export interface ParsedDocument {
  text: string;
  pageCount: number;
  /** True when a PDF yielded so little text that it is almost certainly a scan. */
  likelyScanned: boolean;
  source: 'pdf' | 'docx' | 'txt';
}

export class UnsupportedFileError extends Error {
  constructor(mimeOrName: string) {
    super(`Unsupported file type: ${mimeOrName}. Upload a PDF, DOCX, or TXT file.`);
    this.name = 'UnsupportedFileError';
  }
}

export class EmptyDocumentError extends Error {
  readonly likelyScanned: boolean;
  constructor(likelyScanned: boolean) {
    super(
      likelyScanned
        ? 'This PDF appears to be a scan or image with no selectable text.'
        : 'No readable text could be extracted from this document.',
    );
    this.name = 'EmptyDocumentError';
    this.likelyScanned = likelyScanned;
  }
}

/**
 * A text-based PDF page carries far more than this. Anything below the
 * threshold means the page is an image and needs OCR.
 */
const MIN_CHARS_PER_PAGE = 200;

/** Collapses the ragged whitespace PDF extraction produces, without losing line structure. */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // Required lazily: pdf-parse's index file runs a debug harness that reads a
  // sample PDF off disk when bundled, so it must only load at request time.
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const result = await pdfParse(buffer);

  const text = cleanText(result.text ?? '');
  const pageCount = Math.max(1, result.numpages ?? 1);
  const likelyScanned = text.length / pageCount < MIN_CHARS_PER_PAGE;

  return { text, pageCount, likelyScanned, source: 'pdf' };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const text = cleanText(result.value ?? '');
  return { text, pageCount: 1, likelyScanned: false, source: 'docx' };
}

/**
 * OCR fallback for scanned PDFs.
 *
 * Deliberately behind a flag and behind an interface. tesseract.js downloads
 * ~30MB of WASM and language data on first run and takes 30s+ per page, which
 * would blow past serverless request limits. The detection logic above is the
 * part that matters for correctness; the engine is swappable for a hosted OCR
 * service (Textract, Document AI) without touching any caller.
 */
export interface OcrProvider {
  recognize(buffer: Buffer): Promise<string>;
}

export const tesseractProvider: OcrProvider = {
  async recognize(buffer: Buffer) {
    let createWorker: (typeof import('tesseract.js'))['createWorker'];
    try {
      ({ createWorker } = await import('tesseract.js'));
    } catch {
      throw new Error(
        'ENABLE_OCR is true but tesseract.js is not installed. Run `npm install tesseract.js`.',
      );
    }
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(buffer);
      return cleanText(data.text ?? '');
    } finally {
      await worker.terminate();
    }
  },
};

export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  ocr: OcrProvider = tesseractProvider,
): Promise<ParsedDocument> {
  const lower = fileName.toLowerCase();
  let parsed: ParsedDocument;

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    parsed = await parsePdf(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    parsed = await parseDocx(buffer);
  } else if (mimeType.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    parsed = {
      text: cleanText(buffer.toString('utf8')),
      pageCount: 1,
      likelyScanned: false,
      source: 'txt',
    };
  } else {
    throw new UnsupportedFileError(mimeType || fileName);
  }

  if (parsed.likelyScanned && env.ENABLE_OCR) {
    const ocrText = await ocr.recognize(buffer);
    if (ocrText.length > parsed.text.length) {
      parsed = { ...parsed, text: ocrText, likelyScanned: false };
    }
  }

  if (parsed.text.length < 40) {
    throw new EmptyDocumentError(parsed.likelyScanned);
  }

  return parsed;
}
