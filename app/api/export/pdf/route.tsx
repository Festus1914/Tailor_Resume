import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Times-Roman",
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  name: {
    fontSize: 22,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 4,
    color: "#111111",
    letterSpacing: 3,
  },
  title: {
    fontSize: 11.5,
    textAlign: "center",
    color: "#333333",
    marginBottom: 10,
    fontFamily: "Times-Italic",
    letterSpacing: 0.5,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  contactItem: {
    fontSize: 9.5,
    color: "#1a1a1a",
  },
  linkedin: {
    fontSize: 9.5,
    textAlign: "center",
    color: "#1a1a1a",
    marginBottom: 8,
    textDecoration: "underline",
  },
  headerDividerThick: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111111",
    marginBottom: 2,
  },
  headerDividerThin: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#111111",
    marginBottom: 6,
  },
  sectionRuleAbove: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#111111",
    marginBottom: 3,
  },
  section: {
    fontSize: 11.5,
    fontFamily: "Times-Bold",
    color: "#111111",
    textAlign: "center",
    marginTop: 14,
    marginBottom: 3,
    letterSpacing: 2.2,
  },
  sectionRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111111",
    marginBottom: 9,
  },
  jobHeaderRow: {
    fontSize: 11,
    marginTop: 6,
  },
  jobHeaderTitle: {
    fontFamily: "Times-Bold",
  },
  jobHeaderCompany: {
    fontFamily: "Times-Italic",
    textDecoration: "underline",
  },
  dateLineRow: {
    fontSize: 9.5,
    color: "#333333",
    marginBottom: 4,
  },
  dateLineLocation: {
    fontFamily: "Times-Italic",
    textDecoration: "underline",
  },
  paragraph: {
    marginBottom: 5,
    color: "#1a1a1a",
    fontSize: 10,
    textAlign: "justify",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3.5,
    paddingLeft: 10,
  },
  bulletDot: {
    width: 15,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  skillCategory: {
    fontSize: 10,
    fontFamily: "Times-Bold",
    marginTop: 5,
    letterSpacing: 0.3,
  },
  skillItems: {
    fontSize: 9.5,
    marginBottom: 4,
  },
  buildMarker: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 6,
    color: "#cccccc",
    fontFamily: "Times-Roman",
  },
});

function InlineText({
  text,
  baseStyle,
}: {
  text: string;
  baseStyle: any;
}) {
  const segments = parseInlineSegments(text);
  return (
    <Text style={baseStyle}>
      {segments.map((seg, idx) =>
        seg.bold ? (
          <Text key={idx} style={styles.bold}>
            {seg.text}
          </Text>
        ) : (
          <Text key={idx}>{seg.text}</Text>
        )
      )}
    </Text>
  );
}

function ResumeDoc({ content }: { content: string }) {
  const lines = parseResumeLines(content);
  let headerDone = false;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {lines.map((line, i) => {
          const isFirstNonHeaderLine =
            !headerDone &&
            !["name", "title", "contact", "linkedin", "blank"].includes(
              line.type
            );
          const showHeaderDivider = isFirstNonHeaderLine;
          if (isFirstNonHeaderLine) headerDone = true;

          switch (line.type) {
            case "blank":
              return <View key={i} style={{ height: 3 }} />;

            case "name":
              return (
                <Text key={i} style={styles.name}>
                  {line.text.toUpperCase()}
                </Text>
              );

            case "title":
              return (
                <Text key={i} style={styles.title}>
                  {line.text}
                </Text>
              );

            case "contact": {
              const parts = splitContactLine(line.text);
              return (
                <View key={i} style={styles.contactRow}>
                  {parts.map((p, idx) => (
                    <Text key={idx} style={styles.contactItem}>
                      {p}
                    </Text>
                  ))}
                </View>
              );
            }

            case "linkedin":
              return (
                <Text key={i} style={styles.linkedin}>
                  {line.text}
                </Text>
              );

            case "section":
              return (
                <View key={i}>
                  {showHeaderDivider && (
                    <>
                      <View style={styles.headerDividerThick} />
                      <View style={styles.headerDividerThin} />
                    </>
                  )}
                  {!showHeaderDivider && <View style={styles.sectionRuleAbove} />}
                  <Text style={styles.section}>{line.text.toUpperCase()}</Text>
                  <View style={styles.sectionRule} />
                </View>
              );

            case "job-header": {
              const { title, company } = splitJobHeader(line.text);
              return (
                <Text key={i} style={styles.jobHeaderRow}>
                  <Text style={styles.jobHeaderTitle}>{title}</Text>
                  {company ? <Text>, </Text> : null}
                  {company ? (
                    <Text style={styles.jobHeaderCompany}>{company}</Text>
                  ) : null}
                </Text>
              );
            }

            case "date-line": {
              const { dates, location } = splitDateLine(line.text);
              return (
                <Text key={i} style={styles.dateLineRow}>
                  <Text>{dates}</Text>
                  {location ? <Text> | </Text> : null}
                  {location ? (
                    <Text style={styles.dateLineLocation}>{location}</Text>
                  ) : null}
                </Text>
              );
            }

            case "bullet":
              return (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>—</Text>
                  <InlineText text={line.text} baseStyle={styles.bulletText} />
                </View>
              );

            case "skill-category":
              return (
                <Text key={i} style={styles.skillCategory}>
                  {line.text}
                </Text>
              );

            case "skill-items":
              return (
                <Text key={i} style={styles.skillItems}>
                  {line.text}
                </Text>
              );

            default:
              return (
                <InlineText key={i} text={line.text} baseStyle={styles.paragraph} />
              );
          }
        })}
        <Text style={styles.buildMarker} fixed>
         
        </Text>
      </Page>
    </Document>
  );
}

export async function POST(req: NextRequest) {
  try {
    // Without this, the endpoint is a free document-rendering service for anyone
    // who finds the URL. Phase 7 tightens it further: exports will take a resume
    // id and load the content server-side after an ownership check, instead of
    // rendering whatever body they are handed.
    await requireUser();

    const { content, title } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const buffer = await renderToBuffer(<ResumeDoc content={content} />);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${title || "document"}.pdf"`,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
