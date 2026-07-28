import mammoth from 'mammoth';
import { PARSER_TYPES } from '../constants';
import type { IDocumentParser, ParserInput, ParserOutput } from '../interfaces';
import {
  DocumentCorruptedException,
  ParsingFailedException,
} from '../exceptions';
import type { ProcessedSection } from '../types';

/**
 * Parse DOCX files using mammoth.
 * Extracts headings, paragraphs, and basic table content.
 */
export class DocxParser implements IDocumentParser {
  readonly parserType = PARSER_TYPES.DOCX;
  readonly supportedExtensions = ['docx'] as const;

  canParse(extension: string): boolean {
    return extension.toLowerCase() === 'docx';
  }

  async parse(input: ParserInput): Promise<ParserOutput> {
    const warnings: string[] = [];

    try {
      const htmlResult = await mammoth.convertToHtml({ buffer: input.buffer });
      const textResult = await mammoth.extractRawText({ buffer: input.buffer });

      if (htmlResult.messages.length > 0) {
        for (const msg of htmlResult.messages) {
          warnings.push(`mammoth: ${msg.message}`);
        }
      }

      const sections = this.parseHtmlSections(htmlResult.value);
      const rawText = textResult.value;

      return {
        parserType: this.parserType,
        pages: [],
        sections,
        rawText,
        pageCount: 0,
        warnings,
        needsOcr: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('Could not find file') ||
        message.includes('invalid')
      ) {
        throw new DocumentCorruptedException(input.filename, message);
      }
      throw new ParsingFailedException(input.filename, message);
    }
  }

  /**
   * Lightweight HTML section extraction from mammoth HTML output.
   */
  private parseHtmlSections(html: string): ProcessedSection[] {
    const sections: ProcessedSection[] = [];
    let order = 0;

    const blockPattern = /<(h[1-6]|p|table)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      const innerHtml = match[2];
      const content = this.stripHtml(innerHtml).trim();

      if (!content) continue;

      if (tag.startsWith('h')) {
        sections.push({
          type: 'heading',
          content,
          level: Number(tag.charAt(1)),
          order: order++,
        });
      } else if (tag === 'table') {
        const tableText = this.stripHtml(innerHtml).replace(/\s+/g, ' ').trim();
        sections.push({
          type: 'table',
          content: tableText,
          order: order++,
        });
      } else {
        sections.push({
          type: 'paragraph',
          content,
          order: order++,
        });
      }
    }

    if (sections.length === 0 && html.trim()) {
      const fallback = this.stripHtml(html).trim();
      if (fallback) {
        sections.push({
          type: 'paragraph',
          content: fallback,
          order: 0,
        });
      }
    }

    return sections;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
}
