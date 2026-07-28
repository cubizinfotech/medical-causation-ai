import { PARSER_TYPES } from '../constants';
import type { IDocumentParser, ParserInput, ParserOutput } from '../interfaces';
import type { ProcessedSection } from '../types';

/**
 * Base parser for plain text file formats (TXT, Markdown).
 */
abstract class PlainTextParser implements IDocumentParser {
  abstract readonly parserType:
    typeof PARSER_TYPES.TXT | typeof PARSER_TYPES.MARKDOWN;
  abstract readonly supportedExtensions: readonly string[];

  canParse(extension: string): boolean {
    return this.supportedExtensions.includes(extension.toLowerCase());
  }

  parse(input: ParserInput): Promise<ParserOutput> {
    const rawText = input.buffer.toString('utf-8');
    const sections: ProcessedSection[] = this.extractSections(rawText);

    return Promise.resolve({
      parserType: this.parserType,
      pages: [],
      sections,
      rawText,
      pageCount: 0,
      warnings: [],
      needsOcr: false,
    });
  }

  protected extractSections(rawText: string): ProcessedSection[] {
    return rawText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((content, order) => ({
        type: 'paragraph' as const,
        content,
        order,
      }));
  }
}

export class TxtParser extends PlainTextParser {
  readonly parserType = PARSER_TYPES.TXT;
  readonly supportedExtensions = ['txt'] as const;
}

export class MarkdownParser extends PlainTextParser {
  readonly parserType = PARSER_TYPES.MARKDOWN;
  readonly supportedExtensions = ['md'] as const;

  protected override extractSections(rawText: string): ProcessedSection[] {
    const sections: ProcessedSection[] = [];
    let order = 0;

    const lines = rawText.split('\n');
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      const content = paragraphBuffer.join(' ').trim();
      if (content) {
        sections.push({ type: 'paragraph', content, order: order++ });
      }
      paragraphBuffer = [];
    };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        sections.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2].trim(),
          order: order++,
        });
        continue;
      }

      if (line.trim() === '') {
        flushParagraph();
        continue;
      }

      paragraphBuffer.push(line.trim());
    }

    flushParagraph();
    return sections;
  }
}
