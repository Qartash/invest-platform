import {
  ATTACHMENT_UPLOAD_TYPES,
  IMAGE_UPLOAD_TYPES,
  displayFileName,
  storedFileName,
} from './upload-storage';

describe('storedFileName', () => {
  it('names a file after nothing the caller sent', () => {
    const name = storedFileName('image/png', IMAGE_UPLOAD_TYPES);
    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  // The bug this module exists for: the old name was `${req.params.id}-${Date.now()}${ext}`,
  // and `req.params.id` arrives percent-decoded, so `../../` in the URL walked the file out
  // of uploads/ when multer joined the name onto the destination.
  it.each([
    ['image/png', IMAGE_UPLOAD_TYPES],
    ['application/pdf', ATTACHMENT_UPLOAD_TYPES],
  ])('produces a name with no path in it for %s', (mimeType, accepted) => {
    const name = storedFileName(mimeType, accepted);
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
    expect(name).not.toContain('..');
  });

  it('gives every upload its own name', () => {
    const names = new Set(Array.from({ length: 50 }, () => storedFileName('image/jpeg', IMAGE_UPLOAD_TYPES)));
    expect(names.size).toBe(50);
  });

  // SVG is an image to a picker and a script host to a browser, and uploads are served off
  // the API's own origin.
  it('refuses svg', () => {
    expect(() => storedFileName('image/svg+xml', IMAGE_UPLOAD_TYPES)).toThrow();
  });

  it('refuses anything not on the list, including html dressed as an upload', () => {
    expect(() => storedFileName('text/html', IMAGE_UPLOAD_TYPES)).toThrow();
    expect(() => storedFileName('application/x-msdownload', ATTACHMENT_UPLOAD_TYPES)).toThrow();
  });

  // A plain `accepted[mimeType]` lookup answers for everything on Object's prototype.
  it.each(['constructor', 'toString', '__proto__'])('refuses the inherited property %s', (mimeType) => {
    expect(() => storedFileName(mimeType, IMAGE_UPLOAD_TYPES)).toThrow();
  });
});

describe('displayFileName', () => {
  it('keeps an ordinary name as it is', () => {
    expect(displayFileName('Business plan 2026.pdf')).toBe('Business plan 2026.pdf');
  });

  it('keeps only the last segment of anything that looks like a path', () => {
    expect(displayFileName('../../etc/passwd')).toBe('passwd');
    expect(displayFileName('C:\\Windows\\System32\\notes.txt')).toBe('notes.txt');
  });

  it('drops the invisible characters that fake an extension', () => {
    expect(displayFileName('invoice\u202Egnp.exe')).toBe('invoicegnp.exe');
  });

  it('never answers with nothing', () => {
    expect(displayFileName('...')).toBe('file');
    expect(displayFileName('')).toBe('file');
  });

  it('caps the length', () => {
    expect(displayFileName('a'.repeat(500))).toHaveLength(200);
  });
});
