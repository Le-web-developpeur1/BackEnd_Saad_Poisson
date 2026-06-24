const PDFDocument = require('pdfkit');
const SystemConfig = require('../models/SystemConfig');
const path = require('path');
const fs = require('fs');

// ── FORMAT MONTANT SÉCURISÉ ───────────────────────────
const formatAmount = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return Number(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const ICONS = {
  location:  path.join(__dirname, '../../src/assets/icons/location.png'),
  phone:     path.join(__dirname, '../../src/assets/icons/phone.png'),
  email:     path.join(__dirname, '../../src/assets/icons/email.png'),
  snowflake: path.join(__dirname, '../../src/assets/icons/snowflake.png'),
};

// ══════════════════════════════════════════════════════
// GÉNÉRATION FACTURE PDF
// ══════════════════════════════════════════════════════
const generateInvoicePDF = async (invoice, res) => {
  let config = await SystemConfig.findOne();
  if (!config) config = await SystemConfig.create({});

  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  doc.on('error', (err) => {
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Facture-${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  try {
    const NAVY  = '#1A2B5F';
    const GOLD  = '#D4A017';
    const LIGHT = '#EBF5FB';
    const GRAY  = '#666666';
    const W     = 595;
    const PAGE_H   = 842;
    const FOOTER_H = 38;
    const footerY  = PAGE_H - FOOTER_H;

    const drawIcon = (iconPath, x, y, size = 14) => {
      try {
        if (iconPath && fs.existsSync(iconPath)) {
          doc.image(iconPath, x, y, { width: size, height: size });
        }
      } catch (e) {
      }
    };

    // ── EN-TÊTE ───────────────────────────────────────
    doc.rect(0, 0, W, 155).fill('#FFFFFF');

    if (config.logo) {
      try {
        // Si c'est du base64
        if (config.logo.startsWith('data:')) {
          const base64Data = config.logo.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          doc.image(buffer, 28, 12, { width: 108, height: 108 });
        } else if (config.logo.startsWith('http')) {
          // URL externe (Cloudinary ou autre)
          const https = require('https');
          await new Promise((resolve) => {
            https.get(config.logo, (response) => {
              const chunks = [];
              response.on('data', chunk => chunks.push(chunk));
              response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                try { doc.image(buffer, 28, 12, { width: 108, height: 108 }); } catch (e) {}
                resolve(null);
              });
            }).on('error', resolve);
          });
        } else {
          // Fichier local
          const logoPath = path.join(__dirname, '../../', config.logo.replace('src/', ''));
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 28, 12, { width: 108, height: 108 });
          }
        }
      } catch (e) {
      }
    }

    doc.fontSize(26).font('Helvetica-Bold').fillColor(NAVY)
      .text(config.establishmentName || '', 148, 20);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(GOLD)
      .text(config.establishmentSubtitle || '', 148, 52);
    doc.fontSize(9).font('Helvetica').fillColor('#444444')
      .text(config.description || '', 148, 74);
    doc.moveTo(148, 96).lineTo(318, 96).lineWidth(1.5).stroke(GOLD);

    // ── INFOS CONTACT ─────────────────────────────────
    const infoX = 388;

    drawIcon(ICONS.location, infoX - 8, 16, 13);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
      .text('Adresse :', infoX + 8, 16);
    doc.font('Helvetica').fillColor('#444444')
      .text(config.address || '', infoX + 8, 27, { width: 168 });

    drawIcon(ICONS.phone, infoX - 8, 64, 13);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
      .text('Téléphone 1 :', infoX + 8, 64);
    doc.font('Helvetica').fillColor('#444444')
      .text(config.phone1 || '', infoX + 8, 75);

    drawIcon(ICONS.phone, infoX - 8, 88, 13);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
      .text('Téléphone 2 :', infoX + 8, 88);
    doc.font('Helvetica').fillColor('#444444')
      .text(config.phone2 || '', infoX + 8, 99);

    drawIcon(ICONS.email, infoX - 8, 112, 13);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
      .text('E-mail :', infoX + 8, 112);
    doc.font('Helvetica').fillColor('#444444')
      .text(config.email || '', infoX + 8, 123);

    // ── VAGUE DÉCORATIVE ──────────────────────────────
    doc.save();
    doc.moveTo(0, 145).bezierCurveTo(150, 133, 300, 158, W, 145)
      .lineTo(W, 162).bezierCurveTo(300, 175, 150, 150, 0, 162).fill(NAVY);
    doc.moveTo(0, 155).bezierCurveTo(150, 143, 300, 168, W, 155)
      .lineTo(W, 163).bezierCurveTo(300, 175, 150, 152, 0, 163).fill(GOLD);
    doc.restore();

    // ── BLOC FACTURE ──────────────────────────────────
    const facY = 178;
    doc.roundedRect(368, facY, 197, 36, 6).fill(NAVY);
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('FACTURE', 370, facY + 8, { width: 193, align: 'center' });

    doc.roundedRect(368, facY + 40, 197, 65, 6).lineWidth(1.2).stroke(NAVY);
    doc.moveTo(372, facY + 68).lineTo(561, facY + 68).lineWidth(0.5).stroke('#CCCCCC');

    doc.fontSize(9).font('Helvetica').fillColor(NAVY)
      .text(`N° :   ${invoice.invoiceNumber || '.....................'}`, 378, facY + 50);

    const d = new Date(invoice.createdAt);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    doc.text(`Date :   ${day} / ${month} / ${year}`, 378, facY + 76);

    // ── BLOC FACTURÉ À ────────────────────────────────
    doc.roundedRect(28, facY, 225, 105, 6).lineWidth(1).stroke(NAVY);

    // Titre + Nom sur la même ligne
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
      .text('FACTURÉ À : ', 42, facY + 14, { continued: true })
      .fillColor('#222222')
      .text(invoice.clientName || '', { font: 'Helvetica-Bold' });

    // Téléphone
    const clientPhone = invoice.clientPhone ||
      (typeof invoice.client === 'object' ? invoice.client?.phone : '') || '';
    doc.moveTo(42, facY + 30).lineTo(238, facY + 30).lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
    doc.fontSize(9).font('Helvetica').fillColor('#555555').undash()
      .text(clientPhone ? `Tél : ${clientPhone}` : '', 42, facY + 34);

    // Adresse
    doc.moveTo(42, facY + 52).lineTo(238, facY + 52).lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
    doc.fontSize(9).font('Helvetica').fillColor('#555555').undash()
      .text(invoice.clientAddress ? `Addresse : ${invoice.clientAddress}` : '' || '', 42, facY + 56, { width: 180 });

    doc.moveTo(42, facY + 74).lineTo(238, facY + 74).lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
    // ── TABLEAU ARTICLES ──────────────────────────────
    const tY = 292;
    const cols = {
      num:         { x: 28,  w: 35  },
      designation: { x: 63,  w: 190 },
      qty:         { x: 253, w: 75  },
      unit:        { x: 328, w: 62  },
      price:       { x: 390, w: 105 },
      total:       { x: 495, w: 72  }
    };

    doc.rect(28, tY, 539, 26).fill(NAVY);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('N°',            cols.num.x + 8,        tY + 9);
    doc.text('DÉSIGNATION',   cols.designation.x + 5, tY + 9);
    doc.text('QUANTITÉ',      cols.qty.x + 5,         tY + 9);
    doc.text('UNITÉ',         cols.unit.x + 5,        tY + 9);
    doc.text('PRIX UNITAIRE', cols.price.x + 5,       tY + 9);
    doc.text('MONTANT',       cols.total.x + 5,       tY + 9);

    let rowY = tY + 26;
    const rowH = 24;

    invoice.items.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : LIGHT;
      doc.rect(28, rowY, 539, rowH).fill(bg);
      Object.values(cols).forEach(col => {
        doc.rect(col.x, rowY, col.w, rowH).lineWidth(0.3).stroke('#CCCCCC');
      });
      doc.fontSize(8.5).font('Helvetica').fillColor('#222222');
      doc.text(String(i + 1),                                            cols.num.x + 8,        rowY + 8);
      doc.text(item.designation || '',                                   cols.designation.x + 5, rowY + 8, { width: cols.designation.w - 8 });
      doc.text(String(item.quantity || 0),                               cols.qty.x + 5,         rowY + 8);
      doc.text(item.unit || '',                                          cols.unit.x + 5,        rowY + 8);
      doc.text(`${formatAmount(item.unitPrice)} ${config.currency || 'GNF'}`, cols.price.x + 5, rowY + 8);
      doc.text(`${formatAmount(item.total)} ${config.currency || 'GNF'}`,     cols.total.x + 5, rowY + 8);
      rowY += rowH;
    });

    doc.rect(28, tY, 539, rowY - tY).lineWidth(0.8).stroke(NAVY);

    const BLOC_H = 250;
    const BLOC_Y = footerY - BLOC_H - 10;

    // ── ENCART ────────────────────────────────────────
    doc.roundedRect(28, BLOC_Y, 215, 90, 6).lineWidth(1.5).stroke(GOLD);
    drawIcon(ICONS.snowflake, 38, BLOC_Y + 16, 28);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY)
      .text('POISSONS CONGELÉS', 76, BLOC_Y + 14);
    doc.fontSize(9).font('Helvetica').fillColor(GOLD)
      .text('Qualité • Fraîcheur • Confiance', 76, BLOC_Y + 30);
    doc.fontSize(8.5).fillColor(GRAY)
      .text(config.invoiceTagline || '', 36, BLOC_Y + 54, { width: 198, align: 'center' });

    // ── TOTAUX ────────────────────────────────────────
    const totX = 383;
    const totW = 184;
    const totH = 22;
    let   totY = BLOC_Y;

    const drawTot = (label, value, gold = false, lastRow = false) => {
      doc.rect(totX, totY, totW, totH).fill('#FFFFFF');
      doc.rect(totX, totY, totW, totH)
        .lineWidth(lastRow ? 1.2 : 0.5)
        .stroke(lastRow ? NAVY : '#CCCCCC');
      doc.fontSize(9)
        .font(gold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(gold ? GOLD : '#222222')
        .text(label, totX + 8, totY + 7)
        .text(value, totX + 8, totY + 7, { align: 'right', width: totW - 16 });
      totY += totH;
    };

    drawTot('SOUS-TOTAL', `${formatAmount(invoice.subTotal || 0)} ${config.currency || 'GNF'}`);
    drawTot('REMISE',     `${formatAmount(invoice.discount || 0)} ${config.currency || 'GNF'}`);
    drawTot('TOTAL HT',   `${formatAmount(invoice.totalHT || 0)} ${config.currency || 'GNF'}`);
    drawTot(`TVA (${invoice.tva || 0} %)`, `${formatAmount(Math.round((invoice.totalHT || 0) * (invoice.tva || 0) / 100))} ${config.currency || 'GNF'}`);
    drawTot('TOTAL TTC',  `${formatAmount(invoice.totalTTC || 0)} ${config.currency || 'GNF'}`, true, true);

    // ── LIGNE SÉPARATRICE ─────────────────────────────
    const sepY = BLOC_Y + 110;
    doc.moveTo(28, sepY).lineTo(567, sepY).lineWidth(0.5).stroke('#DDDDDD');

    // ── CONDITIONS DE PAIEMENT ────────────────────────
    const condY = sepY + 18;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
      .text('CONDITIONS DE PAIEMENT :', 28, condY);
    doc.moveTo(28, condY + 18).lineTo(255, condY + 18)
      .lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
    doc.fontSize(9).font('Helvetica').fillColor('#333333').undash()
      .text(invoice.paymentConditions || '', 28, condY + 22);

    doc.moveTo(270, sepY + 5).lineTo(270, footerY - 12)
      .lineWidth(0.5).stroke('#CCCCCC');

    // ── SIGNATURES ────────────────────────────────────
    const sigX = 278;
    const sigW = 289;
    const sigY = condY;

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
      .text('CACHET ET SIGNATURE', sigX, sigY);
    doc.roundedRect(sigX, sigY + 14, sigW, 38, 4).lineWidth(0.8).stroke('#CCCCCC');

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
      .text('SIGNATURE CLIENT', sigX, sigY + 58);
    doc.roundedRect(sigX, sigY + 72, sigW, 38, 4).lineWidth(0.8).stroke('#CCCCCC');

    if (invoice.clientSignature) {
      try {
        const sigData   = invoice.clientSignature.replace(/^data:image\/\w+;base64,/, '');
        const sigBuffer = Buffer.from(sigData, 'base64');
        doc.image(sigBuffer, sigX + 4, sigY + 75, { width: sigW - 8, height: 32 });
      } catch (e) {}
    }

    // ── PIED DE PAGE ──────────────────────────────────
    doc.save();
    doc.moveTo(0, footerY - 8)
      .bezierCurveTo(150, footerY - 16, 300, footerY, W, footerY - 8)
      .lineTo(W, footerY - 2)
      .bezierCurveTo(300, footerY + 6, 150, footerY - 10, 0, footerY - 2)
      .fill(GOLD);
    doc.restore();

    doc.rect(0, footerY, W, FOOTER_H).fill(NAVY);
    doc.fontSize(11).font('Helvetica-BoldOblique').fillColor(GOLD)
      .text(config.invoiceFooter || 'Merci pour votre confiance !', 0, footerY + 13, { align: 'center', width: W });

    doc.end();

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur génération PDF' });
    }
    try { doc.end(); } catch (e) {}
  }
};

// ══════════════════════════════════════════════════════
// GÉNÉRATION RELEVÉ CRÉDIT PDF
// ══════════════════════════════════════════════════════
const generateCreditPDF = async (data, res) => {
  const { client, sales, totalCredit, totalPaid, totalRemaining } = data;

  let config = await SystemConfig.findOne();
  if (!config) config = await SystemConfig.create({});

  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  doc.on('error', (err) => {
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Credit-${client.name}.pdf`);
  doc.pipe(res);

  try {
    const NAVY  = '#1A2B5F';
    const GOLD  = '#D4A017';
    const LIGHT = '#EBF5FB';
    const W     = 595;

    // ── EN-TÊTE ───────────────────────────────────────
    doc.rect(0, 0, W, 100).fill(NAVY);

    if (config.logo) {
      try {
        const logoPath = path.join(__dirname, '../../', config.logo);
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 30, 15, { width: 70, height: 70 });
        }
      } catch (e) {}
    }

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text(config.establishmentName || '', 115, 22);
    doc.fontSize(10).fillColor(GOLD)
      .text(config.establishmentSubtitle || '', 115, 48);
    doc.fontSize(8).fillColor('#CCCCCC')
      .text(config.description || '', 115, 65);
    doc.fontSize(9).fillColor('#CCCCCC')
      .text(`Édité le : ${new Date().toLocaleDateString('fr-FR')}`, 400, 40, { align: 'right', width: 165 });

    // ── TITRE ─────────────────────────────────────────
    doc.rect(0, 100, W, 40).fill('#F8FAFC');
    doc.fontSize(16).font('Helvetica-Bold').fillColor(NAVY)
      .text('RELEVÉ DE COMPTE CRÉDIT', 30, 112);

    // ── INFOS CLIENT ──────────────────────────────────
    doc.rect(30, 158, 255, 80).lineWidth(1).stroke(NAVY);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
      .text('INFORMATIONS CLIENT', 42, 166);
    doc.fontSize(9).font('Helvetica').fillColor('#333')
      .text(`Nom : ${client.name || ''}`, 42, 182)
      .text(`Téléphone : ${client.phone || '—'}`, 42, 196)
      .text(`Adresse : ${client.address || '—'}`, 42, 210);

    // ── RÉSUMÉ CRÉDIT ─────────────────────────────────
    doc.rect(300, 158, 265, 80).lineWidth(1).stroke(NAVY);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
      .text('RÉSUMÉ DU COMPTE', 312, 166);

    const rows = [
      ['Total crédit accordé :', `${formatAmount(totalCredit || 0)} GNF`],
      ['Total remboursé :',      `${formatAmount(totalPaid || 0)} GNF`],
      ['Solde restant :',        `${formatAmount(totalRemaining || 0)} GNF`],
    ];

    let ry = 182;
    rows.forEach(([label, value], i) => {
      doc.fontSize(9).font('Helvetica').fillColor(i === 2 ? '#e53e3e' : '#333')
        .text(label, 312, ry)
        .font(i === 2 ? 'Helvetica-Bold' : 'Helvetica')
        .text(value, 312, ry, { align: 'right', width: 245 });
      ry += 14;
    });

    if (client.isBlocked) {
      doc.rect(300, 222, 265, 16).fill('#FEE2E2');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#e53e3e')
        .text('COMPTE BLOQUÉ — Plafond dépassé', 312, 226);
    }

    // ── TABLEAU VENTES ────────────────────────────────
    const tY = 258;
    doc.rect(30, tY, 535, 24).fill(NAVY);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('N° Vente', 38,  tY + 8);
    doc.text('Date',     130, tY + 8);
    doc.text('Montant',  210, tY + 8);
    doc.text('Payé',     300, tY + 8);
    doc.text('Reste',    385, tY + 8);
    doc.text('Statut',   460, tY + 8);

    let rowY = tY + 24;
    const rowH = 22;

    sales.forEach((sale, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : LIGHT;
      doc.rect(30, rowY, 535, rowH).fill(bg);
      doc.fontSize(8).font('Helvetica').fillColor('#222');
      doc.text(sale.saleNumber || '',                                       38,  rowY + 7);
      doc.text(new Date(sale.createdAt).toLocaleDateString('fr-FR'),        130, rowY + 7);
      doc.text(`${formatAmount(sale.totalAmount || 0)} GNF`,                210, rowY + 7);
      doc.text(`${formatAmount(sale.amountPaid || 0)} GNF`,                 300, rowY + 7);

      const reste = sale.remainingAmount || 0;
      doc.fillColor(reste > 0 ? '#e53e3e' : '#16a34a')
        .text(`${formatAmount(reste)} GNF`, 385, rowY + 7);

      const statusColors = { 'payé': '#16a34a', 'partiel': '#d97706', 'crédit': '#e53e3e' };
      doc.fillColor(statusColors[sale.status] || '#666').font('Helvetica-Bold')
        .text((sale.status || '').toUpperCase(), 460, rowY + 7);

      rowY += rowH;
    });

    doc.rect(30, tY, 535, rowY - tY).lineWidth(0.8).stroke(NAVY);

    // ── TOTAL ─────────────────────────────────────────
    rowY += 10;
    doc.rect(350, rowY, 215, 22).fill(NAVY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('SOLDE RESTANT', 358, rowY + 6);
    doc.fillColor(GOLD)
      .text(`${formatAmount(totalRemaining || 0)} GNF`, 358, rowY + 6, { align: 'right', width: 199 });

    // ── PIED DE PAGE ──────────────────────────────────
    doc.rect(0, 800, W, 42).fill(NAVY);
    doc.fontSize(10).font('Helvetica-BoldOblique').fillColor(GOLD)
      .text(config.invoiceFooter || 'Merci pour votre confiance !', 0, 816, { align: 'center', width: W });

    doc.end();

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur génération PDF' });
    }
    try { doc.end(); } catch (e) {}
  }
};

// ══════════════════════════════════════════════════════
// GÉNÉRATION BULLETIN DE PAIE PDF
// ══════════════════════════════════════════════════════
const generateSalarySlipPDF = async (payment, employee, res) => {
  let config = await SystemConfig.findOne();
  if (!config) config = await SystemConfig.create({});

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Bulletin-${employee.name}-${payment.period}.pdf`);
  doc.pipe(res);

  try {
    const NAVY = '#1A2B5F';
    const GOLD = '#D4A017';
    const W = 595;

    // En-tête
    doc.rect(0, 0, W, 90).fill(NAVY);
    if (config.logo) {
      try {
        if (config.logo.startsWith('data:')) {
          const base64Data = config.logo.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          doc.image(buffer, 20, 10, { width: 65, height: 65 });
        }
      } catch (e) {}
    }
    // Infos établissement à droite
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF')
    .text(config?.establishmentName || 'S.A.D POISSON', 110, 18);
    doc.fontSize(9).font('Helvetica').fillColor(GOLD)
      .text(config?.establishmentSubtitle || 'ENTREPRISE SAADE', 110, 40);
    doc.fontSize(8).fillColor('#CCCCCC')
      .text(config?.description || '', 110, 55);
    doc.fontSize(8).fillColor('#CCCCCC')
      .text(`${config?.address || ''} | Tél: ${config?.phone1 || ''}  -  ${config?.phone2 || ''}`, 110, 68);
    doc.fontSize(8).fillColor('#CCCCCC')
      .text(`Email: ${config?.email || ''}`, 110, 80);
    // Titre
    doc.rect(0, 90, W, 36).fill('#F1F5F9');
    doc.fontSize(15).font('Helvetica-Bold').fillColor(NAVY)
      .text('BULLETIN DE PAIE', 20, 100);
    doc.moveTo(20, 126).lineTo(W - 20, 126).lineWidth(1.5).stroke(GOLD);

    // Infos employé
    let y = 145;
    doc.roundedRect(20, y, W - 40, 100, 6).lineWidth(1).stroke(NAVY);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY).text('INFORMATIONS EMPLOYÉ', 32, y + 12);
    doc.fontSize(9).font('Helvetica').fillColor('#333');
    doc.text(`Nom : ${employee.name}`, 32, y + 30);
    doc.text(`Poste : ${employee.position}`, 32, y + 46);
    doc.text(`Téléphone : ${employee.phone || '—'}`, 32, y + 62);
    doc.text(`Type de salaire : ${employee.salaryType === 'mensuel' ? 'Mensuel' : 'Journalier'}`, 32, y + 78);

    doc.text(`Période : ${payment.period}`, 320, y + 30);
    doc.text(`Date de paiement : ${new Date(payment.paymentDate).toLocaleDateString('fr-FR')}`, 320, y + 46);
    if (payment.daysWorked) {
      doc.text(`Jours travaillés : ${payment.daysWorked}`, 320, y + 62);
    }

    // Montant
    y += 120;
    doc.rect(20, y, W - 40, 50).fill(NAVY);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF').text('MONTANT NET PAYER', 32, y + 17);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(GOLD)
      .text(`${formatAmount(payment.amount)} ${config.currency || 'GNF'}`, 32, y + 14, { align: 'right', width: W - 64 });


    // Note
    if (payment.note) {
      y += 70;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY).text('Note :', 20, y);
      doc.fontSize(9).font('Helvetica').fillColor('#555').text(payment.note, 20, y + 14, { width: W - 40 });
    }

    // Signatures
    y += 90;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY).text('Signature Employeur', 50, y);
    doc.roundedRect(50, y + 15, 200, 50, 4).lineWidth(0.8).stroke('#CCCCCC');

    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY).text('Signature Employé', 320, y);
    doc.roundedRect(320, y + 15, 200, 50, 4).lineWidth(0.8).stroke('#CCCCCC');

    // Footer
    doc.rect(0, 800, W, 42).fill(NAVY);
    doc.fontSize(9).font('Helvetica-BoldOblique').fillColor(GOLD)
      .text(config.invoiceFooter || 'Merci pour votre confiance !', 0, 816, { align: 'center', width: W });

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: 'Erreur génération bulletin' });
    try { doc.end(); } catch (e) {}
  }
};


// ══════════════════════════════════════════════════════
// GÉNÉRATION RECU DE PAIEMENT CREDIT PDF
// ══════════════════════════════════════════════════════
const generateClientPaymentReceiptPDF = async (payment, config, res) => {
  const doc = new PDFDocument({ size: 'A5', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Recu-${payment.clientName}.pdf`);
  doc.pipe(res);

  try {
    const NAVY = '#1A2B5F';
    const GOLD = '#D4A017';
    const W    = 420; // A5 width

    // En-tête
    doc.rect(0, 0, W, 80).fill(NAVY);
    if (config?.logo?.startsWith('data:')) {
      try {
        const buffer = Buffer.from(config.logo.split(',')[1], 'base64');
        doc.image(buffer, 16, 8, { width: 60, height: 60 });
      } catch (e) {}
    }
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
  .text(config?.establishmentName || 'S.A.D POISSON', 90, 18);

doc.fontSize(9).fillColor(GOLD)
  .text(config?.establishmentSubtitle || '', 90, 38);

// Adresse en dessous du sous-titre
doc.fontSize(7.5).fillColor('#CCCCCC')
  .text(`Adresse: ${config?.email || ''}`, 90, 50);

// Téléphones en dessous de l’adresse
doc.fontSize(7.5).fillColor('#CCCCCC')
  .text(`Tél: ${config?.phone1 || ''} | ${config?.phone2 || ''}`, 90, 62);

    // Titre reçu
    doc.rect(0, 80, W, 30).fill('#F1F5F9');
    doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY)
      .text('REÇU DE PAIEMENT', 0, 90, { align: 'center', width: W });

    // Numéro et date
    const date = new Date(payment.createdAt);
    doc.fontSize(8).font('Helvetica').fillColor(NAVY)
      .text(`N° : ${payment._id.toString().slice(-8).toUpperCase()}`, 20, 124)
      .text(`Date : ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 20, 138);

    // Infos client
    doc.roundedRect(20, 160, W - 40, 70, 6).lineWidth(1).stroke(NAVY);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY).text('CLIENT', 32, 170);
    doc.fontSize(9).font('Helvetica').fillColor('#333')
      .text(`Nom : ${payment.clientName}`, 32, 186)
      .text(`Téléphone : ${payment.clientPhone || '—'}`, 32, 202);

    // Montant payé
    doc.rect(20, 248, W - 40, 50).fill(NAVY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('MONTANT REÇU', 32, 260);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(GOLD)
      .text(`${formatAmount(payment.amount)} ${config?.currency || 'GNF'}`, 32, 257, { align: 'right', width: W - 64 });

    // Reste de la dette
    doc.roundedRect(20, 310, W - 40, 36, 6).lineWidth(1).stroke(NAVY);
    doc.fontSize(9).font('Helvetica').fillColor('#555')
      .text('Crédit restant à payé :', 32, 322);
    doc.fontSize(9).font('Helvetica-Bold')
      .fillColor(payment.remainingDebt > 0 ? '#DC2626' : '#16A34A')
      .text(
        `${formatAmount(payment.remainingDebt)} ${config?.currency || 'GNF'}`,
        32, 322,
        { align: 'right', width: W - 64 }
      );

    // Signature
    const sigY = 370;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
      .text('Signature du caissier', 30, sigY);
    doc.roundedRect(30, sigY + 14, 160, 40, 4).lineWidth(0.8).stroke('#CCCCCC');

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
      .text('Signature du client', 220, sigY);
    doc.roundedRect(220, sigY + 14, 160, 40, 4).lineWidth(0.8).stroke('#CCCCCC');

    // Footer
    doc.rect(0, 580 - 30, W, 30).fill(NAVY);
    doc.fontSize(8).font('Helvetica-BoldOblique').fillColor(GOLD)
      .text(config?.invoiceFooter || 'Merci pour votre confiance !', 0, 580 - 20, { align: 'center', width: W });

    doc.end();
  } catch (err) {
    console.error('Erreur reçu PDF:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur génération reçu' });
    try { doc.end(); } catch (e) {}
  }
};

// ── EXPORTS ───────────────────────────────────────────
module.exports = { generateInvoicePDF, generateCreditPDF, generateSalarySlipPDF, generateClientPaymentReceiptPDF };

