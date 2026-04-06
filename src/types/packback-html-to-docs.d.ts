declare module "@packback/html-to-docx" {
  export type HtmlToDocxOptions = Record<string, unknown>;

  export default function HTMLtoDOCX(
    html: string,
    headerHtml?: string | null,
    documentOptions?: HtmlToDocxOptions,
    footerHtml?: string | null
  ): Promise<Blob> | Blob;
}