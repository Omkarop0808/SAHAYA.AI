import pdfParse from 'pdf-parse';

export async function extractPdfText(buffer) {
  if (!buffer || !buffer.length) throw new Error('Empty PDF');
  const data = await pdfParse(buffer);
  const text = (data.text || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 30) {
    throw new Error('Could not extract enough text from PDF (try a text-based PDF or paste text).');
  }
  return text.slice(0, 200_000);
}
