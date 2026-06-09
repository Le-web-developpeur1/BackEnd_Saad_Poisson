const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType } = require('docx');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

const NAVY = '#1A2B5F';

const formatAmount = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// ── PDF ───────────────────────────────────────────────
const exportPDF = (title, headers, rows, res, filename) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
  doc.pipe(res);

  // En-tête
  doc.rect(0, 0, 595, 70).fill(NAVY);
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#FFFFFF')
    .text('S.A.D POISSON', 50, 15);
  doc.fontSize(10).fillColor('#CCCCCC')
    .text('Commerce et Distribution de Poissons Congelés en Gros', 50, 42);

  // Titre rapport
  doc.fontSize(16).font('Helvetica-Bold').fillColor(NAVY)
    .text(title, 50, 90);
  doc.fontSize(9).font('Helvetica').fillColor('#666666')
    .text(`Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 50, 112);

  doc.moveTo(50, 128).lineTo(545, 128).stroke(NAVY);

  // Tableau header
  let y = 140;
  const colWidth = 495 / headers.length;

  doc.rect(50, y, 495, 22).fill(NAVY);
  headers.forEach((h, i) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text(h, 50 + i * colWidth + 4, y + 7, { width: colWidth - 8 });
  });
  y += 22;

  // Lignes
  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? '#EBF5FB' : '#FFFFFF';
    doc.rect(50, y, 495, 20).fill(bg);
    row.forEach((cell, i) => {
      doc.fontSize(8).font('Helvetica').fillColor('#222222')
        .text(String(cell ?? '—'), 50 + i * colWidth + 4, y + 6, { width: colWidth - 8 });
    });
    y += 20;

    // Nouvelle page si nécessaire
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
  });

  // Bordure tableau
  doc.rect(50, 140, 495, y - 140).stroke(NAVY);

  // Pied de page
  doc.rect(0, 800, 595, 42).fill(NAVY);
  doc.fontSize(9).font('Helvetica').fillColor('#CCCCCC')
    .text('Merci pour votre confiance !', 0, 815, { align: 'center', width: 595 });

  doc.end();
};

// ── WORD ──────────────────────────────────────────────
const exportWord = async (title, headers, rows, res, filename) => {
  const bd = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: bd, bottom: bd, left: bd, right: bd };

  const colWidth = Math.floor(9360 / headers.length);

  const tableRows = [
    new TableRow({
      children: headers.map(h => new TableCell({
        borders,
        width: { size: colWidth, type: WidthType.DXA },
        shading: { fill: '1A2B5F', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18, font: 'Arial' })]
        })]
      }))
    }),
    ...rows.map((row, idx) => new TableRow({
      children: row.map((cell, j) => new TableCell({
        borders,
        width: { size: colWidth, type: WidthType.DXA },
        shading: { fill: idx % 2 === 0 ? 'EBF5FB' : 'FFFFFF', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({
          children: [new TextRun({ text: String(cell ?? '—'), size: 18, font: 'Arial' })]
        })]
      }))
    }))
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } }
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'S.A.D POISSON', bold: true, size: 32, font: 'Arial', color: '1A2B5F' })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: 'Commerce et Distribution de Poissons Congelés en Gros', size: 18, font: 'Arial', color: '666666' })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: title, bold: true, size: 26, font: 'Arial', color: '1A2B5F' })]
        }),
        new Paragraph({
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: `Généré le : ${new Date().toLocaleDateString('fr-FR')}`, size: 18, font: 'Arial', color: '666666', italics: true })]
        }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: headers.map(() => colWidth),
          rows: tableRows
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.docx`);
  res.send(buffer);
};

// ── CSV ───────────────────────────────────────────────
const exportCSV = async (headers, rows, res, filename) => {
  const tmpPath = path.join(__dirname, `../../tmp_${filename}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: tmpPath,
    header: headers.map((h, i) => ({ id: String(i), title: h })),
    encoding: 'utf8'
  });

  const records = rows.map(row => {
    const obj = {};
    row.forEach((cell, i) => { obj[String(i)] = cell ?? ''; });
    return obj;
  });

  await csvWriter.writeRecords(records);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
  res.write('\uFEFF'); // BOM pour Excel
  fs.createReadStream(tmpPath)
    .on('end', () => fs.unlinkSync(tmpPath))
    .pipe(res);
};

module.exports = { exportPDF, exportWord, exportCSV };