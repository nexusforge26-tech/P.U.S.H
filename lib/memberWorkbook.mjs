import JSZip from "jszip";

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const MAX_CELL_CHARS = 32767;

function xmlEscape(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, MAX_CELL_CHARS)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function excelDateSerial(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
}

function cellXml(reference, value, styleId) {
  const style = styleId === undefined ? "" : ` s=\"${styleId}\"`;
  if (value === null || value === undefined || value === "") {
    return `<c r=\"${reference}\"${style} t=\"inlineStr\"><is><t></t></is></c>`;
  }
  if (value instanceof Date) {
    const serial = excelDateSerial(value);
    return serial === null
      ? `<c r=\"${reference}\"${style} t=\"inlineStr\"><is><t></t></is></c>`
      : `<c r=\"${reference}\"${style} t=\"n\"><v>${serial}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r=\"${reference}\"${style} t=\"n\"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r=\"${reference}\"${style} t=\"b\"><v>${value ? 1 : 0}</v></c>`;
  }
  // Inline strings remain text cells: values beginning with '=' are never written as formulas.
  return `<c r=\"${reference}\"${style} t=\"inlineStr\"><is><t xml:space=\"preserve\">${xmlEscape(value)}</t></is></c>`;
}

function normalizeSheetName(name, index, seen) {
  const base = String(name || `ورقة ${index + 1}`)
    .replace(/[\\/?*\[\]:]/g, " ")
    .trim()
    .slice(0, 31) || `Sheet${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (seen.has(candidate)) {
    const tail = ` ${suffix++}`;
    candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
  }
  seen.add(candidate);
  return candidate;
}

function worksheetXml(sheet, sheetIndex, generatedAt) {
  const columns = Array.isArray(sheet.columns) ? sheet.columns : [];
  const safeColumns = columns.length ? columns : [{ key: "empty", header: "لا توجد بيانات", width: 24 }];
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
  const lastColumn = columnName(safeColumns.length);
  const lastRow = 4 + rows.length;
  const widths = safeColumns.map((column, index) => {
    const width = Math.min(60, Math.max(8, Number(column.width) || 20));
    return `<col min=\"${index + 1}\" max=\"${index + 1}\" width=\"${width}\" customWidth=\"1\"/>`;
  }).join("");

  const title = xmlEscape(sheet.title || sheet.name || "تصدير بيانات الأعضاء");
  const subtitleParts = [
    `تاريخ التصدير: ${generatedAt.toISOString()}`,
    `عدد السجلات: ${rows.length.toLocaleString("en-US")}`,
    sheet.subtitle || "",
  ].filter(Boolean);
  const subtitle = xmlEscape(subtitleParts.join(" | "));

  const titleRow = `<row r=\"1\" ht=\"30\" customHeight=\"1\">${cellXml("A1", title, 1)}</row>`;
  const subtitleRow = `<row r=\"2\" ht=\"24\" customHeight=\"1\">${cellXml("A2", subtitle, 2)}</row>`;
  const headerCells = safeColumns.map((column, index) =>
    cellXml(`${columnName(index + 1)}4`, column.header || column.key || "", 3)
  ).join("");
  const headerRow = `<row r=\"4\" ht=\"30\" customHeight=\"1\">${headerCells}</row>`;

  const dataRows = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 5;
    const alternate = rowIndex % 2 === 1;
    const cells = safeColumns.map((column, columnIndex) => {
      const value = row?.[column.key];
      const isDate = value instanceof Date;
      const styleId = isDate ? (alternate ? 7 : 6) : (alternate ? 5 : 4);
      return cellXml(`${columnName(columnIndex + 1)}${excelRow}`, value, styleId);
    }).join("");
    return `<row r=\"${excelRow}\" ht=\"24\" customHeight=\"1\">${cells}</row>`;
  }).join("");

  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<worksheet xmlns=\"${MAIN_NS}\" xmlns:r=\"${REL_NS}\">` +
    `<dimension ref=\"A1:${lastColumn}${lastRow}\"/>` +
    `<sheetViews><sheetView showGridLines=\"1\" rightToLeft=\"1\" workbookViewId=\"0\"><pane ySplit=\"4\" topLeftCell=\"A5\" activePane=\"bottomLeft\" state=\"frozen\"/><selection pane=\"bottomLeft\" activeCell=\"A5\" sqref=\"A5\"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight=\"18\"/><cols>${widths}</cols>` +
    `<sheetData>${titleRow}${subtitleRow}<row r=\"3\"/>${headerRow}${dataRows}</sheetData>` +
    `<autoFilter ref=\"A4:${lastColumn}${lastRow}\"/>` +
    `<mergeCells count=\"2\"><mergeCell ref=\"A1:${lastColumn}1\"/><mergeCell ref=\"A2:${lastColumn}2\"/></mergeCells>` +
    `<pageMargins left=\"0.25\" right=\"0.25\" top=\"0.5\" bottom=\"0.5\" header=\"0.2\" footer=\"0.2\"/>` +
    `</worksheet>`;
}

function stylesXml() {
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<styleSheet xmlns=\"${MAIN_NS}\">` +
    `<numFmts count=\"1\"><numFmt numFmtId=\"164\" formatCode=\"dd/mm/yyyy hh:mm\"/></numFmts>` +
    `<fonts count=\"4\">` +
      `<font><sz val=\"11\"/><color rgb=\"FF20251E\"/><name val=\"Arial\"/><family val=\"2\"/></font>` +
      `<font><b/><sz val=\"16\"/><color rgb=\"FFFFFFFF\"/><name val=\"Arial\"/><family val=\"2\"/></font>` +
      `<font><b/><sz val=\"11\"/><color rgb=\"FFFFFFFF\"/><name val=\"Arial\"/><family val=\"2\"/></font>` +
      `<font><b/><sz val=\"10\"/><color rgb=\"FF46513D\"/><name val=\"Arial\"/><family val=\"2\"/></font>` +
    `</fonts>` +
    `<fills count=\"5\">` +
      `<fill><patternFill patternType=\"none\"/></fill>` +
      `<fill><patternFill patternType=\"gray125\"/></fill>` +
      `<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF394A32\"/><bgColor indexed=\"64\"/></patternFill></fill>` +
      `<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF6C7957\"/><bgColor indexed=\"64\"/></patternFill></fill>` +
      `<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFF3F5EF\"/><bgColor indexed=\"64\"/></patternFill></fill>` +
    `</fills>` +
    `<borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border>` +
      `<border><left style=\"thin\"><color rgb=\"FFD9DED2\"/></left><right style=\"thin\"><color rgb=\"FFD9DED2\"/></right><top style=\"thin\"><color rgb=\"FFD9DED2\"/></top><bottom style=\"thin\"><color rgb=\"FFD9DED2\"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>` +
    `<cellXfs count=\"8\">` +
      `<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>` +
      `<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyAlignment=\"1\"><alignment horizontal=\"center\" vertical=\"center\"/></xf>` +
      `<xf numFmtId=\"0\" fontId=\"3\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\" vertical=\"center\" wrapText=\"1\"/></xf>` +
      `<xf numFmtId=\"0\" fontId=\"2\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"center\" vertical=\"center\" wrapText=\"1\"/></xf>` +
      `<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>` +
      `<xf numFmtId=\"0\" fontId=\"0\" fillId=\"4\" borderId=\"1\" xfId=\"0\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>` +
      `<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\"/></xf>` +
      `<xf numFmtId=\"164\" fontId=\"0\" fillId=\"4\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\"/></xf>` +
    `</cellXfs>` +
    `<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>` +
    `</styleSheet>`;
}

function contentTypesXml(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName=\"/xl/worksheets/sheet${index + 1}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>`
  ).join("");
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">` +
    `<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>` +
    `<Default Extension=\"xml\" ContentType=\"application/xml\"/>` +
    `<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>` +
    `<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>` +
    `<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>` +
    `<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>` +
    sheets + `</Types>`;
}

function workbookXml(sheets) {
  const sheetNodes = sheets.map((sheet, index) =>
    `<sheet name=\"${xmlEscape(sheet.name)}\" sheetId=\"${index + 1}\" r:id=\"rId${index + 1}\"/>`
  ).join("");
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<workbook xmlns=\"${MAIN_NS}\" xmlns:r=\"${REL_NS}\">` +
    `<fileVersion appName=\"xl\" lastEdited=\"7\" lowestEdited=\"7\" rupBuild=\"27120\"/>` +
    `<workbookPr defaultThemeVersion=\"124226\"/>` +
    `<bookViews><workbookView xWindow=\"0\" yWindow=\"0\" windowWidth=\"24000\" windowHeight=\"12000\" activeTab=\"0\"/></bookViews>` +
    `<sheets>${sheetNodes}</sheets><calcPr calcId=\"191029\" fullCalcOnLoad=\"1\" forceFullCalc=\"1\"/>` +
    `</workbook>`;
}

function workbookRelsXml(sheetCount) {
  const rels = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id=\"rId${index + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet${index + 1}.xml\"/>`
  ).join("");
  return `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<Relationships xmlns=\"${PACKAGE_REL_NS}\">${rels}` +
    `<Relationship Id=\"rId${sheetCount + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>` +
    `</Relationships>`;
}

export async function createXlsxWorkbook(inputSheets, generatedAt = new Date()) {
  const source = Array.isArray(inputSheets) ? inputSheets : [];
  const seen = new Set();
  const sheets = source.map((sheet, index) => ({
    ...sheet,
    name: normalizeSheetName(sheet.name, index, seen),
  }));
  if (sheets.length === 0) {
    sheets.push({
      name: "ملخص التصدير",
      title: "تصدير بيانات أعضاء PUSH",
      subtitle: "لا توجد بيانات متاحة للتصدير.",
      columns: [{ key: "note", header: "ملاحظة", width: 40 }],
      rows: [],
    });
  }

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(sheets.length));
  zip.file("_rels/.rels", `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<Relationships xmlns=\"${PACKAGE_REL_NS}\">` +
    `<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>` +
    `<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>` +
    `<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>` +
    `</Relationships>`);
  zip.file("xl/workbook.xml", workbookXml(sheets));
  zip.file("xl/_rels/workbook.xml.rels", workbookRelsXml(sheets.length));
  zip.file("xl/styles.xml", stylesXml());
  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet, index, generatedAt));
  });

  const timestamp = generatedAt.toISOString();
  zip.file("docProps/core.xml", `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">` +
    `<dc:title>تصدير بيانات أعضاء PUSH</dc:title><dc:creator>PUSH</dc:creator><cp:lastModifiedBy>PUSH</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type=\"dcterms:W3CDTF\">${xmlEscape(timestamp)}</dcterms:created>` +
    `<dcterms:modified xsi:type=\"dcterms:W3CDTF\">${xmlEscape(timestamp)}</dcterms:modified>` +
    `</cp:coreProperties>`);
  const titles = sheets.map((sheet) => `<vt:lpstr>${xmlEscape(sheet.name)}</vt:lpstr>`).join("");
  zip.file("docProps/app.xml", `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>` +
    `<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\">` +
    `<Application>PUSH</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>` +
    `<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
    `<TitlesOfParts><vt:vector size=\"${sheets.length}\" baseType=\"lpstr\">${titles}</vt:vector></TitlesOfParts>` +
    `<Company>PUSH</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion>` +
    `</Properties>`);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
