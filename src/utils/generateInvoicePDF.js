const PDFDocument = require('pdfkit');
const SystemConfig = require('../models/SystemConfig');
const path = require('path');
const fs = require('fs');

const formatAmount = (amount) => {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const ICONS = {
  location:  path.join(__dirname, '../../src/assets/icons/location.png'),
  phone:     path.join(__dirname, '../../src/assets/icons/phone.png'),
  email:     path.join(__dirname, '../../src/assets/icons/email.png'),
  snowflake: path.join(__dirname, '../../src/assets/icons/snowflake.png'),
};

const generateInvoicePDF = async (invoice, res) => {
  let config = await SystemConfig.findOne();
  if (!config) config = await SystemConfig.create({});

  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Facture-${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  const NAVY  = '#1A2B5F';
  const GOLD  = '#D4A017';
  const LIGHT = '#EBF5FB';
  const GRAY  = '#666666';
  const W     = 595;
  const PAGE_H    = 842;
  const FOOTER_H  = 38;
  const footerY   = PAGE_H - FOOTER_H;

  const drawIcon = (iconPath, x, y, size = 14) => {
    if (fs.existsSync(iconPath)) {
      doc.image(iconPath, x, y, { width: size, height: size });
    }
  };

  // ── EN-TÊTE ───────────────────────────────────────
  doc.rect(0, 0, W, 155).fill('#FFFFFF');

  if (config.logo) {
    const logoPath = path.join(__dirname, '../../', config.logo);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 28, 12, { width: 108, height: 108 });
    }
  }

  doc.fontSize(26).font('Helvetica-Bold').fillColor(NAVY)
    .text(config.establishmentName, 148, 20);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(GOLD)
    .text(config.establishmentSubtitle, 148, 52);
  doc.fontSize(9).font('Helvetica').fillColor('#444444')
    .text(config.description, 148, 74);
  doc.moveTo(148, 96).lineTo(318, 96).lineWidth(1.5).stroke(GOLD);

  // ── INFOS CONTACT ─────────────────────────────────
  const infoX = 388;

  drawIcon(ICONS.location, infoX - 8, 16, 13);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
    .text('Adresse :', infoX + 8, 16);
  doc.font('Helvetica').fillColor('#444444')
    .text(config.address, infoX + 8, 27, { width: 168 });

  drawIcon(ICONS.phone, infoX - 8, 64, 13);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
    .text('Téléphone 1 :', infoX + 8, 64);
  doc.font('Helvetica').fillColor('#444444')
    .text(config.phone1, infoX + 8, 75);

  drawIcon(ICONS.phone, infoX - 8, 88, 13);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
    .text('Téléphone 2 :', infoX + 8, 88);
  doc.font('Helvetica').fillColor('#444444')
    .text(config.phone2, infoX + 8, 99);

  drawIcon(ICONS.email, infoX - 8, 112, 13);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
    .text('E-mail :', infoX + 8, 112);
  doc.font('Helvetica').fillColor('#444444')
    .text(config.email, infoX + 8, 123);

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

  doc.roundedRect(368, facY + 40, 197, 52, 6).lineWidth(1.2).stroke(NAVY);
  doc.moveTo(372, facY + 62).lineTo(561, facY + 62).lineWidth(0.5).stroke('#CCCCCC');

  doc.fontSize(9).font('Helvetica').fillColor(NAVY)
    .text(`N° :   ${invoice.invoiceNumber || '.....................'}`, 378, facY + 48);

  const d = new Date(invoice.createdAt);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  doc.text(`Date :   ${day} / ${month} / ${year}`, 378, facY + 68);

  // ── BLOC FACTURÉ À ────────────────────────────────
  doc.roundedRect(28, facY, 225, 90, 6).lineWidth(1).stroke(NAVY);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
    .text('FACTURÉ À :', 42, facY + 12);
  doc.moveTo(42, facY + 30).lineTo(238, facY + 30).lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
  doc.fontSize(10).font('Helvetica').fillColor('#222222').undash()
    .text(invoice.clientName || '', 42, facY + 34);
  doc.moveTo(42, facY + 52).lineTo(238, facY + 52).lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
  doc.fontSize(9).font('Helvetica').fillColor('#555555').undash()
    .text(invoice.clientAddress || '', 42, facY + 56, { width: 180 });
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
    doc.text(String(i + 1),                                          cols.num.x + 8,        rowY + 8);
    doc.text(item.designation,                                       cols.designation.x + 5, rowY + 8, { width: cols.designation.w - 8 });
    doc.text(String(item.quantity),                                  cols.qty.x + 5,         rowY + 8);
    doc.text(item.unit,                                              cols.unit.x + 5,        rowY + 8);
    doc.text(`${formatAmount(item.unitPrice)} ${config.currency}`,   cols.price.x + 5,       rowY + 8);
    doc.text(`${formatAmount(item.total)} ${config.currency}`,       cols.total.x + 5,       rowY + 8);
    rowY += rowH;
  });

  doc.rect(28, tY, 539, rowY - tY).lineWidth(0.8).stroke(NAVY);

  // ══ BLOC BAS — tout ancré à position fixe ══════════
  // Hauteurs des blocs bas :
  // encart        : 90px
  // totaux        : 5 × 22 + 2 = 112px
  // sep           : 10px
  // conditions+sig: 90px
  // total bloc    : ~302px
  // On place le bloc à footerY - 302 - 10 (marge)

  const BLOC_H   = 250;
  const BLOC_Y   = footerY - BLOC_H - 10;

  // ── ENCART POISSONS CONGELÉS ──────────────────────
  doc.roundedRect(28, BLOC_Y, 215, 90, 6).lineWidth(1.5).stroke(GOLD);
  drawIcon(ICONS.snowflake, 38, BLOC_Y + 16, 28);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY)
    .text('POISSONS CONGELÉS', 76, BLOC_Y + 14);
  doc.fontSize(9).font('Helvetica').fillColor(GOLD)
    .text('Qualité • Fraîcheur • Confiance', 76, BLOC_Y + 30);
  doc.fontSize(8.5).fillColor(GRAY)
    .text(config.invoiceTagline, 36, BLOC_Y + 54, { width: 198, align: 'center' });

  // ── TOTAUX (alignés à droite, même hauteur que encart) ──
  const totX  = 383;
  const totW  = 184;
  const totH  = 22;
  let   totY  = BLOC_Y;

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

  drawTot('SOUS-TOTAL', `${formatAmount(invoice.subTotal)} ${config.currency}`);
  drawTot('REMISE',     `${formatAmount(invoice.discount)} ${config.currency}`);
  drawTot('TOTAL HT',   `${formatAmount(invoice.totalHT)} ${config.currency}`);
  drawTot(`TVA (${invoice.tva} %)`, `${formatAmount(Math.round(invoice.totalHT * invoice.tva / 100))} ${config.currency}`);
  drawTot('TOTAL TTC',  `${formatAmount(invoice.totalTTC)} ${config.currency}`, true, true);

  // ── LIGNE SÉPARATRICE HORIZONTALE ─────────────────
  const sepY = BLOC_Y + 100;
  doc.moveTo(28, sepY).lineTo(567, sepY).lineWidth(0.5).stroke('#DDDDDD');

  // ── CONDITIONS DE PAIEMENT ────────────────────────
  const condY = sepY + 14;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
    .text('CONDITIONS DE PAIEMENT :', 28, condY);
  doc.moveTo(28, condY + 18).lineTo(255, condY + 18)
    .lineWidth(0.5).dash(2, { space: 2 }).stroke('#AAAAAA');
  doc.fontSize(9).font('Helvetica').fillColor('#333333').undash()
    .text(invoice.paymentConditions || '', 28, condY + 22);

  // Ligne verticale séparatrice
  doc.moveTo(270, sepY + 5).lineTo(270, footerY - 12)
    .lineWidth(0.5).stroke('#CCCCCC');

  // ── ZONES DE SIGNATURE (droite) ───────────────────
  const sigX = 278;
  const sigW = 289;
  const sigY = condY + 20; // ← décalé plus bas

  // Cachet et signature établissement
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
    .text('CACHET ET SIGNATURE', sigX, sigY);
  doc.roundedRect(sigX, sigY + 14, sigW, 38, 4)
    .lineWidth(0.8).stroke('#CCCCCC');

  // Signature client
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY)
    .text('SIGNATURE CLIENT', sigX, sigY + 58);
  doc.roundedRect(sigX, sigY + 72, sigW, 38, 4)
    .lineWidth(0.8).stroke('#CCCCCC');

  if (invoice.clientSignature) {
    try {
      const sigData   = invoice.clientSignature.replace(/^data:image\/\w+;base64,/, '');
      const sigBuffer = Buffer.from(sigData, 'base64');
      doc.image(sigBuffer, sigX + 4, sigY + 75, { width: sigW - 8, height: 32 });
    } catch (e) {}
  }
  // ── PIED DE PAGE ANCRÉ EN BAS ─────────────────────
  doc.save();
  doc.moveTo(0, footerY - 8)
    .bezierCurveTo(150, footerY - 16, 300, footerY, W, footerY - 8)
    .lineTo(W, footerY - 2)
    .bezierCurveTo(300, footerY + 6, 150, footerY - 10, 0, footerY - 2)
    .fill(GOLD);
  doc.restore();

  doc.rect(0, footerY, W, FOOTER_H).fill(NAVY);
  doc.fontSize(11).font('Helvetica-BoldOblique').fillColor(GOLD)
    .text(config.invoiceFooter, 0, footerY + 13, { align: 'center', width: W });

  doc.end();
};



module.exports = generateInvoicePDF;