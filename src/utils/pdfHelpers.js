const PDFDocument = require('pdfkit');

// ══════════════════════════════════════════════════════
// COULEURS STANDARDS
// ══════════════════════════════════════════════════════
const COLORS = {
  PRIMARY: '#2E75B6',
  SECONDARY: '#5B9BD5',
  LIGHT: '#D9EAF7',
  HEADER_BG: '#FFFFFF',
  GOLD: '#F2B233',
  BORDER: '#D9D9D9',
  TEXT: '#333333',
  TEXT_LIGHT: '#666666',
  TEXT_LIGHTER: '#999999',
  SUCCESS: '#2E8B57',
  DANGER: '#C0392B',
  WARNING: '#F39C12',
  WHITE: '#FFFFFF',
  GRAY_LIGHT: '#F7FBFE',
  GRAY: '#CCCCCC'
};

const PAGE_WIDTH = 595;

// ══════════════════════════════════════════════════════
// FONCTION : FORMATER LES MONTANTS
// ══════════════════════════════════════════════════════
const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR').format(amount || 0);
};

// ══════════════════════════════════════════════════════
// FONCTION : EN-TÊTE STANDARD POUR TOUS LES PDF
// ══════════════════════════════════════════════════════
const drawStandardHeader = (doc, config, title, subtitle = null) => {
  // Fond blanc de l'en-tête
  doc.rect(0, 0, PAGE_WIDTH, 95).fill(COLORS.HEADER_BG);

  // Ligne de séparation dorée
  doc.moveTo(20, 95)
    .lineTo(PAGE_WIDTH - 20, 95)
    .lineWidth(1)
    .stroke(COLORS.GOLD);

  // Logo à gauche
  if (config.logo) {
    try {
      if (config.logo.startsWith('data:')) {
        const buffer = Buffer.from(config.logo.split(',')[1], 'base64');
        doc.image(buffer, 25, 15, { width: 58, height: 58 });
      }
    } catch (e) {
      console.error('Erreur chargement logo:', e.message);
    }
  }

  // Nom de l'établissement
  doc.font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(COLORS.PRIMARY)
    .text(config.establishmentName || 'S.A.D POISSON', 95, 18);

  // Sous-titre de l'établissement
  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.GOLD)
    .text(config.establishmentSubtitle || '', 95, 42);

  // Adresse
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.TEXT)
    .text(config.address || '', 95, 58);

  // Téléphones
  doc.text(`Tel : ${config.phone1 || ''} - ${config.phone2 || ''}`, 95, 70);

  // Email
  doc.text(`Email : ${config.email || ''}`, 95, 82);

  // Date d'édition (à droite)
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.TEXT_LIGHT)
    .text(
      `Édité le : ${new Date().toLocaleDateString('fr-FR')}`,
      380,
      20,
      { width: 180, align: 'right' }
    );

  // Titre du document
  doc.font('Helvetica-Bold')
    .fontSize(17)
    .fillColor('#222222')
    .text(title, 25, 110);

  // Sous-titre optionnel
  if (subtitle) {
    doc.font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.TEXT_LIGHTER)
      .text(subtitle, 25, 130);
  }

  // Ligne séparatrice
  doc.moveTo(25, 145)
    .lineTo(PAGE_WIDTH - 25, 145)
    .lineWidth(1)
    .stroke(COLORS.GOLD);

  return 160; // Position Y après l'en-tête
};

// ══════════════════════════════════════════════════════
// FONCTION : FOOTER STANDARD POUR TOUS LES PDF
// ══════════════════════════════════════════════════════
const drawStandardFooter = (doc, pageNumber = 1, totalPages = 1, footerText = null) => {
  const footerY = 800;

  // Ligne de séparation
  doc.moveTo(25, footerY)
    .lineTo(PAGE_WIDTH - 25, footerY)
    .lineWidth(0.5)
    .stroke(COLORS.GRAY);

  // Texte personnalisé à gauche (optionnel)
  if (footerText) {
    doc.font('Helvetica')
      .fontSize(7)
      .fillColor(COLORS.TEXT_LIGHTER)
      .text(footerText, 25, footerY + 8, { width: 300 });
  }

  // Numéro de page à droite
  doc.font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.TEXT_LIGHTER)
    .text(
      `Page ${pageNumber} / ${totalPages}`,
      PAGE_WIDTH - 100,
      footerY + 8,
      { width: 75, align: 'right' }
    );
};

// ══════════════════════════════════════════════════════
// FONCTION : BOÎTE D'INFORMATION AVEC BORDURE
// ══════════════════════════════════════════════════════
const drawInfoBox = (doc, x, y, width, height, title, content) => {
  // Bordure de la boîte
  doc.roundedRect(x, y, width, height, 4)
    .lineWidth(0.8)
    .stroke(COLORS.BORDER);

  // En-tête de la boîte
  doc.rect(x, y, width, 22).fill(COLORS.LIGHT);

  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.PRIMARY)
    .text(title, x + 15, y + 7);

  // Contenu
  let contentY = y + 30;
  doc.font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.TEXT);

  content.forEach(item => {
    if (item.label && item.value) {
      doc.text(`${item.label} : `, x + 15, contentY, { continued: true });
      doc.font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(item.color || COLORS.TEXT)
        .text(item.value);
      contentY += 16;
    }
  });

  return contentY; // Retourne la position Y après le contenu
};

// ══════════════════════════════════════════════════════
// FONCTION : TABLEAU STANDARD
// ══════════════════════════════════════════════════════
const drawStandardTable = (doc, headers, rows, startY, options = {}) => {
  const {
    columnWidths = null,  // Tableau des largeurs personnalisées
    alignments = {},      // { columnIndex: 'left'|'center'|'right' }
    formatters = {},      // { columnIndex: (value) => formattedValue }
    rowHeight = 24
  } = options;

  const tableWidth = PAGE_WIDTH - 50;
  const startX = 25;
  let y = startY;

  // Calculer les largeurs de colonnes
  const colCount = headers.length;
  const colWidths = columnWidths || Array(colCount).fill(tableWidth / colCount);

  // Fonction pour obtenir la position X d'une colonne
  const getColX = (colIndex) => {
    return startX + colWidths.slice(0, colIndex).reduce((sum, w) => sum + w, 0);
  };

  // EN-TÊTE DU TABLEAU
  doc.roundedRect(startX, y, tableWidth, 26, 2).fill(COLORS.PRIMARY);

  doc.font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.WHITE);

  headers.forEach((header, i) => {
    const colX = getColX(i);
    const align = alignments[i] || 'left';
    doc.text(header, colX + 5, y + 8, { 
      width: colWidths[i] - 10, 
      align 
    });
  });

  y += 26;

  // LIGNES DU TABLEAU
  rows.forEach((row, rowIndex) => {
    // Gestion nouvelle page
    if (y + rowHeight > 760) {
      doc.addPage();
      y = 40;

      // Répéter l'en-tête
      doc.roundedRect(startX, y, tableWidth, 26, 2).fill(COLORS.PRIMARY);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.WHITE);

      headers.forEach((header, i) => {
        const colX = getColX(i);
        const align = alignments[i] || 'left';
        doc.text(header, colX + 5, y + 8, { width: colWidths[i] - 10, align });
      });

      y += 26;
    }

    // Fond alterné
    doc.rect(startX, y, tableWidth, rowHeight)
      .fill(rowIndex % 2 === 0 ? COLORS.WHITE : COLORS.GRAY_LIGHT);

    // Ligne de séparation
    doc.moveTo(startX, y + rowHeight)
      .lineTo(startX + tableWidth, y + rowHeight)
      .lineWidth(0.4)
      .stroke(COLORS.BORDER);

    // Contenu des cellules
    doc.font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.TEXT);

    row.forEach((cell, colIndex) => {
      const colX = getColX(colIndex);
      const align = alignments[colIndex] || 'left';
      
      // Appliquer le formateur si défini
      let value = cell;
      if (formatters[colIndex]) {
        value = formatters[colIndex](cell);
      }

      // Gestion de la couleur et du style
      if (typeof value === 'object' && value.text !== undefined) {
        doc.font(value.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(value.color || COLORS.TEXT)
          .text(value.text, colX + 5, y + 8, { 
            width: colWidths[colIndex] - 10, 
            align 
          });
      } else {
        doc.text(String(value), colX + 5, y + 8, { 
          width: colWidths[colIndex] - 10, 
          align 
        });
      }
    });

    y += rowHeight;
  });

  return y; // Retourne la position Y après le tableau
};

// ══════════════════════════════════════════════════════
// FONCTION : BADGE DE STATUT
// ══════════════════════════════════════════════════════
const drawBadge = (doc, text, x, y, variant = 'primary') => {
  const badgeColors = {
    primary: { bg: COLORS.LIGHT, text: COLORS.PRIMARY },
    success: { bg: '#D4EDDA', text: COLORS.SUCCESS },
    danger: { bg: '#F8D7DA', text: COLORS.DANGER },
    warning: { bg: '#FFF3CD', text: COLORS.WARNING },
    secondary: { bg: '#E2E3E5', text: '#6C757D' }
  };

  const colors = badgeColors[variant] || badgeColors.primary;

  // Mesurer le texte
  doc.font('Helvetica-Bold').fontSize(7);
  const textWidth = doc.widthOfString(text);
  const badgeWidth = textWidth + 16;
  const badgeHeight = 16;

  // Dessiner le badge
  doc.roundedRect(x, y, badgeWidth, badgeHeight, 8)
    .fill(colors.bg);

  doc.fillColor(colors.text)
    .text(text, x + 8, y + 5, { width: textWidth });

  return badgeWidth; // Retourne la largeur du badge
};

// ══════════════════════════════════════════════════════
// FONCTION : SECTION RÉSUMÉ AVEC TOTAUX
// ══════════════════════════════════════════════════════
const drawSummarySection = (doc, items, startY) => {
  let y = startY + 20;
  const rightX = PAGE_WIDTH - 25;

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.TEXT);

  items.forEach(item => {
    doc.text(`${item.label} :`, rightX - 250, y, { width: 150, align: 'right' });
    
    doc.font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(item.large ? 11 : 9)
      .fillColor(item.color || COLORS.TEXT)
      .text(item.value, rightX - 100, y, { width: 100, align: 'right' });

    y += item.large ? 20 : 16;
  });

  return y;
};

// ══════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════
module.exports = {
  COLORS,
  PAGE_WIDTH,
  formatAmount,
  drawStandardHeader,
  drawStandardFooter,
  drawInfoBox,
  drawStandardTable,
  drawBadge,
  drawSummarySection
};
