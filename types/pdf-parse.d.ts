/**
 * pdf-parse is imported via its inner module to skip the debug harness in its
 * index.js. @types/pdf-parse only declares the package root, so mirror the
 * types here for the deep path.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  import pdfParse from 'pdf-parse';
  export default pdfParse;
}
