import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
} from "docx";
import {
  parseResumeLines,
  parseInlineSegments,
  splitJobHeader,
  splitDateLine,
  splitContactLine,
} from "@/lib/resumeParser";
import { requireUser } from "@/lib/auth/guards";
import { toErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// Garamond is preinstalled on Windows/Office and reads as a classic, executive
// serif — closer to a premium letterhead than the web-safe Times New Roman.
const FONT = "Garamond";
const PAGE_WIDTH_TWIPS = 12240;
const MARGIN_TWIPS = 1000;
const USABLE_WIDTH = PAGE_WIDTH_TWIPS - MARGIN_TWIPS * 2;

function inlineRuns(
  text: string,
  extra: { size?: number; color?: string } = {}
) {
  return parseInlineSegments(text).map(
    (seg) =>
      new TextRun({
        text: seg.text,
        bold: seg.bold,
        font: FONT,
        size: extra.size,
        color: extra.color,
      })
  );
}

function headerDividerParagraph(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: "111111",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 8,
      },
    },
    spacing: { after: 60 },
  });
}

function buildParagraphs(content: string): Paragraph[] {
  const lines = parseResumeLines(content);
  const paragraphs: Paragraph[] = [];
  let headerDone = false;

  for (const line of lines) {
    const isFirstNonHeaderLine =
      !headerDone &&
      !["name", "title", "contact", "linkedin", "blank"].includes(line.type);
    if (isFirstNonHeaderLine) {
      headerDone = true;
      paragraphs.push(headerDividerParagraph());
    }

    switch (line.type) {
      case "blank":
        paragraphs.push(new Paragraph({ text: "" }));
        break;

      case "name":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 30 },
            children: [
              new TextRun({
                text: line.text,
                bold: true,
                size: 46,
                font: FONT,
                characterSpacing: 12,
              }),
            ],
          })
        );
        break;

      case "title":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: line.text,
                italics: true,
                size: 24,
                font: FONT,
                color: "333333",
              }),
            ],
          })
        );
        break;

      case "contact": {
        const parts = splitContactLine(line.text);
        paragraphs.push(
          new Paragraph({
            tabStops: [
              { type: TabStopType.CENTER, position: USABLE_WIDTH / 2 },
              { type: TabStopType.RIGHT, position: USABLE_WIDTH },
            ],
            spacing: { after: 40 },
            children: parts.flatMap((p, idx) => [
              ...(idx > 0 ? [new TextRun({ text: "\t" })] : []),
              new TextRun({ text: p, size: 19, font: FONT }),
            ]),
          })
        );
        break;
      }

      case "linkedin":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: line.text,
                size: 19,
                font: FONT,
                underline: {},
              }),
            ],
          })
        );
        break;

      case "section":
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 30 },
            children: [
              new TextRun({
                text: line.text.toUpperCase(),
                bold: true,
                size: 25,
                font: FONT,
                characterSpacing: 20,
              }),
            ],
          })
        );
        paragraphs.push(
          new Paragraph({
            border: {
              bottom: {
                color: "111111",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 5,
              },
            },
            spacing: { after: 120 },
          })
        );
        break;

      case "job-header": {
        const { title, company } = splitJobHeader(line.text);
        paragraphs.push(
          new Paragraph({
            spacing: { before: 120, after: 20 },
            children: [
              new TextRun({ text: title, bold: true, size: 22, font: FONT }),
              ...(company
                ? [
                    new TextRun({ text: ", ", size: 22, font: FONT }),
                    new TextRun({
                      text: company,
                      italics: true,
                      underline: {},
                      size: 22,
                      font: FONT,
                    }),
                  ]
                : []),
            ],
          })
        );
        break;
      }

      case "date-line": {
        const { dates, location } = splitDateLine(line.text);
        paragraphs.push(
          new Paragraph({
            spacing: { after: 50 },
            children: [
              new TextRun({ text: dates, size: 19, color: "333333", font: FONT }),
              ...(location
                ? [
                    new TextRun({ text: " | ", size: 19, color: "333333", font: FONT }),
                    new TextRun({
                      text: location,
                      italics: true,
                      underline: {},
                      size: 19,
                      color: "333333",
                      font: FONT,
                    }),
                  ]
                : []),
            ],
          })
        );
        break;
      }

      case "bullet":
        // Custom square bullet with a hanging indent, rather than Word's
        // default round bullet, for a more deliberate, executive look.
        paragraphs.push(
          new Paragraph({
            indent: { left: 360, hanging: 360 },
            spacing: { after: 50 },
            children: [
              new TextRun({ text: "▪   ", size: 14, font: FONT }),
              ...inlineRuns(line.text, { size: 20 }),
            ],
          })
        );
        break;

      case "skill-category":
        paragraphs.push(
          new Paragraph({
            spacing: { before: 70, after: 15 },
            children: [
              new TextRun({ text: line.text, bold: true, size: 20, font: FONT }),
            ],
          })
        );
        break;

      case "skill-items":
        paragraphs.push(
          new Paragraph({
            spacing: { after: 70 },
            children: [new TextRun({ text: line.text, size: 19, font: FONT })],
          })
        );
        break;

      default:
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 90 },
            children: inlineRuns(line.text, { size: 20 }),
          })
        );
    }
  }

  return paragraphs;
}

function buildMarkerParagraph(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
    children: [
      new TextRun({
        text: "template-executive-v4",
        size: 12,
        color: "CCCCCC",
        font: FONT,
      }),
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();

    const { content, title } = await req.json();

    // Better validation
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Resume content is required to generate DOCX" },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: "Resume content cannot be empty" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const filename = (title || "resume")
      .slice(0, 100)
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim() || "resume";

    let buffer: Buffer;
    try {
      // Add timeout for document generation
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: { width: PAGE_WIDTH_TWIPS, height: 15840 },
                margin: {
                  top: MARGIN_TWIPS,
                  bottom: MARGIN_TWIPS,
                  left: MARGIN_TWIPS,
                  right: MARGIN_TWIPS,
                },
              },
            },
            children: buildParagraphs(content).concat(buildMarkerParagraph()),
          },
        ],
        styles: {
          default: {
            document: {
              run: { font: FONT, size: 20 },
            },
          },
        },
      });

      buffer = await Packer.toBuffer(doc);
    } catch (docErr) {
      console.error("DOCX generation error:", docErr);
      return NextResponse.json(
        { error: "Failed to generate DOCX. Please try again." },
        { status: 500 }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (err) {
    console.error("DOCX export error:", err);
    return toErrorResponse(err);
  }
}
