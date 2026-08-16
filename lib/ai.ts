import OpenAI from 'openai';
import { env, usingMockAi } from './env';
import { formatIsoDate } from './dates';
import {
  extractionResultSchema,
  openAiExtractionSchema,
  type ExtractionResult,
} from './extraction-schema';
import { mockExtract } from './mock-extractor';

export class ExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export interface ExtractParams {
  text: string;
  semesterName: string;
  semesterStart: Date;
  semesterEnd: Date;
}

/**
 * Syllabi are long; the schedule table that matters is usually in the first
 * few pages. Truncating keeps latency and cost predictable while retaining the
 * grading breakdown and calendar in virtually every real document.
 */
const MAX_CHARS = 60_000;

const SYSTEM_PROMPT = `You are a precise academic document extraction engine. You read university course syllabi and return structured data about the course, its grading breakdown, and every dated item a student must act on.

Rules you must follow:

1. Extract EVERY schedulable item: exams, midterms, finals, assignments, problem sets, quizzes, projects, milestones, presentations, and required readings with due dates.
2. Copy "rawDateText" VERBATIM from the document. Never paraphrase, reformat, or invent it. If an item genuinely has no date text, use null.
3. Only set "resolvedDate" when the document gives an unambiguous calendar date. Format it as YYYY-MM-DD.
4. When the document expresses timing as a semester week ("Week 8", "Week 3 lecture"), set "weekNumber" and leave "resolvedDate" null. The calling application resolves week numbers against the real academic calendar; you must not guess the calendar date yourself.
5. Confidence rules, applied strictly:
   - "HIGH": the document states an explicit calendar date for this item.
   - "MEDIUM": timing is given as a week number or a clear relative reference.
   - "LOW": timing is vague ("late in the term", "TBD"), inferred, or absent.
6. Be conservative. If you are unsure, choose the LOWER confidence. A missed date the student fixes in review is far better than a confidently wrong date on their calendar.
7. Never invent an item that is not in the document. Never invent a grading weight.
8. Grading weights are percentages of the final grade expressed as numbers between 0 and 100.`;

function buildUserPrompt(params: ExtractParams): string {
  const { text, semesterName, semesterStart, semesterEnd } = params;
  const truncated = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[document truncated]` : text;

  return `Academic term: ${semesterName}
Semester start date: ${formatIsoDate(semesterStart)}
Semester end date: ${formatIsoDate(semesterEnd)}

Any calendar date you extract must fall inside that range. If a date in the document falls outside it, the year is probably wrong or the item belongs to a different term — mark it LOW confidence and leave resolvedDate null.

Extract the course metadata, the grading breakdown, and every dated item from the syllabus below.

--- BEGIN SYLLABUS ---
${truncated}
--- END SYLLABUS ---`;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  // Force the SDK to use Node's native fetch instead of its bundled node-fetch
  // polyfill. The polyfill's gzip handling intermittently throws
  // ERR_STREAM_PREMATURE_CLOSE on some networks; native fetch (available on
  // every Node version Next.js 15 supports) doesn't have that issue.
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY, fetch: globalThis.fetch });
  return client;
}

/**
 * Step 2 of the pipeline. Uses OpenAI Structured Outputs so the response is
 * guaranteed by the API to match our JSON Schema — no regex repair, no
 * "please respond with valid JSON" prompt-begging, no retry-on-parse-failure.
 * The Zod re-validation on the way out catches semantic drift the schema
 * cannot express.
 */
export async function extractSyllabus(params: ExtractParams): Promise<ExtractionResult> {
  if (usingMockAi) {
    return mockExtract(params);
  }

  let raw: string | undefined;
  try {
    const response = await getClient().chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(params) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'syllabus_extraction',
          strict: true,
          schema: openAiExtractionSchema as unknown as Record<string, unknown>,
        },
      },
    });

    const choice = response.choices[0];
    if (choice?.finish_reason === 'length') {
      throw new ExtractionError('The model ran out of output tokens before finishing the extraction.');
    }
    if (choice?.message.refusal) {
      throw new ExtractionError(`The model refused this document: ${choice.message.refusal}`);
    }
    raw = choice?.message.content ?? undefined;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      error instanceof Error ? `OpenAI request failed: ${error.message}` : 'OpenAI request failed.',
      error,
    );
  }

  if (!raw) throw new ExtractionError('The model returned an empty response.');

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new ExtractionError('The model returned malformed JSON.', error);
  }

  const parsed = extractionResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractionError(
      `Extraction failed validation: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
      parsed.error,
    );
  }

  return parsed.data;
}
