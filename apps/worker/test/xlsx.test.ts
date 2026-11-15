import { describe, expect, it } from 'vitest';
import { crc32, createXlsx } from '../src/lib/xlsx';

/** Minimal reader for stored (uncompressed) ZIP entries – enough to check our writer. */
function readZip(bytes: Uint8Array): Map<string, { data: Uint8Array; crc: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = new Map<string, { data: Uint8Array; crc: number }>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(0); // method: stored
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    entries.set(name, { data: bytes.subarray(start, start + size), crc });
    offset = start + size;
  }
  // Central directory follows, then the end record with the entry count.
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 10, true)).toBe(entries.size);
  expect(view.getUint32(end + 16, true)).toBe(offset); // central directory offset
  return entries;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('createXlsx', () => {
  const file = createXlsx({
    sheetName: 'Cennik',
    columns: [
      { header: 'Pozycja', width: 40 },
      { header: 'Cena netto (zł)', width: 16, format: 'money' },
    ],
    rows: [
      ['Płytki 60×120 – ściany', 18000],
      ['Listwa / narożnik <&> "x"', 4050],
    ],
  });
  const zip = readZip(file);
  const text = (name: string) => new TextDecoder().decode(zip.get(name)!.data);

  it('contains the files Excel needs, with correct CRCs', () => {
    expect([...zip.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/app.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    for (const { data, crc } of zip.values()) expect(crc32(data)).toBe(crc);
  });

  it('writes strings inline (escaped) and money as numbers in złoty with 2 decimals', () => {
    const sheet = text('xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t>Pozycja</t></is></c>');
    expect(sheet).toContain('<t>Płytki 60×120 – ściany</t>');
    expect(sheet).toContain('<t>Listwa / narożnik &lt;&amp;&gt; &quot;x&quot;</t>');
    expect(sheet).toContain('<c r="B2" s="2"><v>180.00</v></c>');
    expect(sheet).toContain('<c r="B3" s="2"><v>40.50</v></c>');
    expect(sheet).toContain('<col min="1" max="1" width="40" customWidth="1"/>');
    expect(text('xl/workbook.xml')).toContain('<sheet name="Cennik" sheetId="1" r:id="rId1"/>');
    expect(text('xl/styles.xml')).toContain('formatCode="#,##0.00"');
  });

  it('handles an empty sheet (header only)', () => {
    const empty = readZip(createXlsx({ sheetName: 'X', columns: [{ header: 'A' }], rows: [] }));
    expect(new TextDecoder().decode(empty.get('xl/worksheets/sheet1.xml')!.data)).toContain('r="A1"');
  });
});
