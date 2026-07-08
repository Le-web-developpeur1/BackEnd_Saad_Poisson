const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = require('docx');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs   = require('fs');

// ══════════════════════════════════════════════════════
// NOUVELLES COULEURS (comme l'historique client)
// ══════════════════════════════════════════════════════
const NAVY = '#2E75B6'; // PRIMARY - Remplace l'ancien #1A2B5F
const GOLD = '#F2B233'; // Nouveau GOLD - Remplace l'ancien #D4A017

// ── EN-TÊTE PDF AVEC LOGO ─────────────────────────
const drawHeader = async (doc, config, title) => {
  const W = 595;

  // ══════════════════════════════════════════════════════
  // FOND BLANC (comme les autres PDF)
  // ══════════════════════════════════════════════════════
  doc.rect(0, 0, W, 95).fill('#FFFFFF');

  // Ligne de séparation dorée
  doc.moveTo(20, 95)
    .lineTo(W - 20, 95)
    .lineWidth(1)
    .stroke(GOLD);

  // Logo à gauche
  if (config?.logo) {
    try {
      if (config.logo.startsWith('data:')) {
        const base64Data = config.logo.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        doc.image(buffer, 25, 15, { width: 58, height: 58 });
      } else if (config.logo.startsWith('http')) {
        const https = require('https');
        await new Promise((resolve) => {
          https.get(config.logo, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
              try {
                const buffer = Buffer.concat(chunks);
                doc.image(buffer, 25, 15, { width: 58, height: 58 });
              } catch (e) {}
              resolve(null);
            });
          }).on('error', resolve);
        });
      } else {
        const logoPath = path.join(__dirname, '../../', config.logo.replace('src/', ''));
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 25, 15, { width: 58, height: 58 });
        }
      }
    } catch (e) {}
  }

  // Nom de l'établissement
  doc.fontSize(18).font('Helvetica-Bold').fillColor(NAVY)
    .text(config?.establishmentName || 'S.A.D POISSON', 95, 18);

  // Sous-titre de l'établissement
  doc.fontSize(10).font('Helvetica-Bold').fillColor(GOLD)
    .text(config?.establishmentSubtitle || '', 95, 42);

  // Adresse
  doc.fontSize(8).font('Helvetica').fillColor('#333333')
    .text(config?.address || '', 95, 58);

  // Téléphones
  doc.text(`Tel : ${config?.phone1 || ''} - ${config?.phone2 || ''}`, 95, 70);

  // Email
  doc.text(`Email : ${config?.email || ''}`, 95, 82);

  // Date d'édition (à droite)
  doc.fontSize(8).fillColor('#666666')
    .text(
      `Édité le : ${new Date().toLocaleDateString('fr-FR')}`,
      380,
      20,
      { width: 180, align: 'right' }
    );

  // ══════════════════════════════════════════════════════
  // TITRE DU RAPPORT
  // ══════════════════════════════════════════════════════
  doc.fontSize(17).font('Helvetica-Bold').fillColor('#222222')
    .text(title, 25, 110);

  doc.fontSize(8).font('Helvetica').fillColor('#777777')
    .text(
      `Généré le : ${new Date().toLocaleString('fr-FR')}`,
      25,
      130
    );

  // Ligne séparatrice
  doc.moveTo(25, 145)
    .lineTo(W - 25, 145)
    .lineWidth(1)
    .stroke(GOLD);
};

// ── TABLEAU PDF ───────────────────────────────────
const drawTable = (doc, headers, rows, startY) => {
  const W        = 595;
  const margin   = 20;
  const tableW   = W - margin * 2;
  const colWidth = tableW / headers.length;
  let   y        = startY;

  // Header tableau
  doc.rect(margin, y, tableW, 24).fill(NAVY);
  headers.forEach((h, i) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text(h, margin + i * colWidth + 5, y + 8, { width: colWidth - 10 });
  });
  y += 24;

  // Lignes
  rows.forEach((row, idx) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
      // Répéter le header
      doc.rect(margin, y, tableW, 24).fill(NAVY);
      headers.forEach((h, i) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
          .text(h, margin + i * colWidth + 5, y + 8, { width: colWidth - 10 });
      });
      y += 24;
    }

    const bg = idx % 2 === 0 ? '#FFFFFF' : '#EBF5FB';
    doc.rect(margin, y, tableW, 20).fill(bg);
    row.forEach((cell, i) => {
      doc.fontSize(7.5).font('Helvetica').fillColor('#222222')
        .text(String(cell ?? '—'), margin + i * colWidth + 5, y + 6, { width: colWidth - 10 });
    });
    y += 20;
  });

  // Bordure tableau
  doc.rect(margin, startY, tableW, y - startY).lineWidth(0.8).stroke(NAVY);

  return y;
};

// ── TOTAUX EN BAS ─────────────────────────────────
const drawTotals = (doc, totals, y) => {
  const W      = 595;
  const margin = 20;

  y += 15;
  doc.moveTo(margin, y).lineTo(W - margin, y).lineWidth(0.5).stroke('#CCCCCC');
  y += 10;

  doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY)
    .text('TOTAUX GÉNÉRAUX', margin, y);
  y += 18;

  const totW = 250;
  const totX = W - margin - totW;

  totals.forEach(({ label, value, highlight }) => {
    doc.rect(totX, y, totW, 22)
      .fill(highlight ? NAVY : '#F8FAFC');
    doc.fontSize(9)
      .font(highlight ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(highlight ? GOLD : '#333333')
      .text(label, totX + 8, y + 7)
      .text(value, totX + 8, y + 7, { align: 'right', width: totW - 16 });
    doc.rect(totX, y, totW, 22).lineWidth(0.5).stroke('#CCCCCC');
    y += 22;
  });

  return y;
};

// ── PIED DE PAGE ──────────────────────────────────
const drawFooter = (doc, config) => {
  const W       = 595;
  const PAGE_H  = 842;
  doc.rect(0, PAGE_H - 35, W, 35).fill(NAVY);
  doc.fontSize(9).font('Helvetica-BoldOblique').fillColor(GOLD)
    .text(config?.invoiceFooter || 'Merci pour votre confiance !', 0, PAGE_H - 22, { align: 'center', width: W });
};

// ══════════════════════════════════════════════════
// EXPORT PDF
// ══════════════════════════════════════════════════
const exportPDF = async (title, headers, rows, res, filename, totals = [], config = null) => {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
  doc.pipe(res);

  await drawHeader(doc, config, title);

  const endY = drawTable(doc, headers, rows, 160); // Position ajustée pour le nouvel en-tête

  if (totals.length > 0) {
    drawTotals(doc, totals, endY);
  }

  drawFooter(doc, config);
  doc.end();
};

// ══════════════════════════════════════════════════
// EXPORT WORD
// ══════════════════════════════════════════════════
const exportWord = async (title, headers, rows, res, filename) => {
  const bd      = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
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

// ══════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════
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
  res.write('\uFEFF');
  fs.createReadStream(tmpPath)
    .on('end', () => { try { fs.unlinkSync(tmpPath); } catch (e) {} })
    .pipe(res);
};

module.exports = { exportPDF, exportWord, exportCSV };