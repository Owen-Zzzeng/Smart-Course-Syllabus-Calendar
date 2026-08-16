import { z } from 'zod';

export const EVENT_TYPES = ['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'READING', 'OTHER'] as const;
export const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * The Zod schema is the single source of truth for what the model may return.
 * `openAiExtractionSchema` below is the hand-written JSON Schema handed to the
 * OpenAI structured-output API; this Zod schema re-validates the response.
 *
 * Both layers matter: schema enforcement guarantees the *shape*, Zod guarantees
 * the *semantics* (enum spelling, ranges, ISO date validity) and gives us a
 * typed object instead of `any`.
 */
export const extractedEventSchema = z.object({
  title: z.string().min(1),
  type: z.enum(EVENT_TYPES),
  rawDateText: z.string().nullable(),
  resolvedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'resolvedDate must be YYYY-MM-DD')
    .nullable(),
  weekNumber: z.number().int().min(1).max(30).nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  description: z.string().nullable(),
  gradeWeight: z.number().min(0).max(100).nullable(),
});

export const extractedComponentSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
});

export const extractionResultSchema = z.object({
  courseName: z.string().min(1),
  courseCode: z.string().nullable(),
  instructor: z.string().nullable(),
  gradingComponents: z.array(extractedComponentSchema),
  events: z.array(extractedEventSchema),
});

export type ExtractedEvent = z.infer<typeof extractedEventSchema>;
export type ExtractedComponent = z.infer<typeof extractedComponentSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * JSON Schema passed to OpenAI's `response_format: { type: 'json_schema' }`.
 *
 * Structured Outputs requires every property to be listed in `required` and
 * `additionalProperties: false` on every object; optionality is expressed with
 * nullable union types instead.
 */
export const openAiExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['courseName', 'courseCode', 'instructor', 'gradingComponents', 'events'],
  properties: {
    courseName: {
      type: 'string',
      description: 'Full human-readable course title, e.g. "Introduction to Databases".',
    },
    courseCode: {
      type: ['string', 'null'],
      description: 'Course code such as "CS 348". Null if not stated.',
    },
    instructor: {
      type: ['string', 'null'],
      description: 'Primary instructor name. Null if not stated.',
    },
    gradingComponents: {
      type: 'array',
      description: 'Every graded component with its percentage of the final grade.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'weight'],
        properties: {
          name: { type: 'string' },
          weight: {
            type: 'number',
            description: 'Percentage of final grade as a number between 0 and 100.',
          },
        },
      },
    },
    events: {
      type: 'array',
      description: 'Every dated or schedulable item: exams, assignments, quizzes, projects, readings, milestones.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'type',
          'rawDateText',
          'resolvedDate',
          'weekNumber',
          'confidence',
          'description',
          'gradeWeight',
        ],
        properties: {
          title: { type: 'string' },
          type: { type: 'string', enum: [...EVENT_TYPES] },
          rawDateText: {
            type: ['string', 'null'],
            description:
              'The EXACT date text copied verbatim from the document, e.g. "Week 8" or "October 15th". Never paraphrase.',
          },
          resolvedDate: {
            type: ['string', 'null'],
            description:
              'YYYY-MM-DD only when the document states an unambiguous calendar date. Null for relative references like "Week 8".',
          },
          weekNumber: {
            type: ['integer', 'null'],
            description:
              'Semester week number when the document expresses the date as "Week N". Null otherwise.',
          },
          confidence: {
            type: 'string',
            enum: [...CONFIDENCE_LEVELS],
            description:
              'HIGH = explicit calendar date. MEDIUM = week number or relative reference. LOW = vague or inferred.',
          },
          description: { type: ['string', 'null'] },
          gradeWeight: {
            type: ['number', 'null'],
            description: 'Percent of the final grade this single item is worth, if stated.',
          },
        },
      },
    },
  },
} as const;
