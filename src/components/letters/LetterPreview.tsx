import React from 'react';
import { closingLine, type LetterDocument } from '../../utils/clinical/letters';

interface LetterPreviewProps {
  document: LetterDocument;
  /** Shown in the corner, e.g. "Example: invented patient" */
  note?: string;
}

/**
 * The letter as it prints (letterPdf.ts draws the PDF from the same document): the letterhead band in the practice
 * colour, the date, who it is to, the subject, the text and the signature. A picture of the page for checking; the
 * PDF is what is printed and sent.
 */
export const LetterPreview: React.FC<LetterPreviewProps> = ({ document: doc, note }) => (
  <figure className="overflow-hidden rounded-xl border border-gray-200 bg-white text-[13px] leading-relaxed text-gray-900 shadow-sm" aria-label="Preview of the letter">
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-white" style={{ backgroundColor: doc.primaryColor }}>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{doc.practiceName}</p>
        {doc.practiceLines.slice(0, 3).map(line => (
          <p key={line} className="truncate text-[10px] opacity-90">
            {line}
          </p>
        ))}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-bold">{doc.title}</p>
        {doc.reference && <p className="text-[10px] opacity-90">{doc.reference}</p>}
      </div>
    </div>
    <div className="space-y-3 px-4 py-4">
      <p className="text-right text-gray-700">{doc.dateText}</p>
      {doc.recipientLines.length > 0 && (
        <div>
          {doc.recipientLines.map((line, index) => (
            <p key={`${line}-${index}`} className={index === 0 ? 'font-semibold' : undefined}>
              {line}
            </p>
          ))}
        </div>
      )}
      {doc.subjectLine && <p className="font-semibold">{doc.subjectLine}</p>}
      {doc.salutation && <p>{doc.salutation},</p>}
      {doc.paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-wrap break-words">
          {paragraph}
        </p>
      ))}
      {doc.sections.map(section => (
        <div key={section.heading}>
          <p className="font-semibold">{section.heading}</p>
          {section.lines.map(line => (
            <p key={line}>{section.lines.length > 1 ? `- ${line}` : line}</p>
          ))}
        </div>
      ))}
      <div className="pt-2">
        <p>{closingLine(doc.closing)}</p>
        {doc.signatureImage && <img src={doc.signatureImage} alt="Signature" className="mt-2 h-12 w-36 object-contain object-left" />}
        <div className={`mb-1 w-40 border-t border-gray-300 ${doc.signatureImage ? 'mt-1' : 'mt-6'}`} aria-hidden="true" />
        {doc.signatureLines.map((line, index) => (
          <p key={line} className={index === 0 ? 'font-semibold' : 'text-gray-600'}>
            {line}
          </p>
        ))}
      </div>
    </div>
    {note && <figcaption className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">{note}</figcaption>}
  </figure>
);

export default LetterPreview;
