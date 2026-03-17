const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

const LABEL_SIZES = {
  small: [162, 162],
  medium: [288, 288],
  large: [288, 432],
};

const resolveSize = (size) => {
  if (!size) return 'A7';
  if (Array.isArray(size)) return size;
  if (LABEL_SIZES[size]) return LABEL_SIZES[size];
  return size;
};

const renderLabel = async ({ product, template, quantity = 1 }) => {
  const doc = new PDFDocument({ size: resolveSize(template?.size), margin: 10 });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (let i = 0; i < quantity; i += 1) {
    doc.fontSize(12).text(product.name || 'Product', { width: 200 });
    doc.fontSize(10).text(`SKU: ${product.code || product.id}`);
    doc.fontSize(10).text(`Price: ${product.price || 0}`);
    try {
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: product.barcodeFormat === 'code128' ? 'code128' : 'qrcode',
        text: product.code || `${product.id}`,
        scale: product.barcodeFormat === 'code128' ? 3 : 6,
        includetext: product.barcodeFormat === 'code128',
        textxalign: 'center',
      });
      doc.moveDown(0.5);
      doc.image(barcodeBuffer, {
        fit: [template?.barcodeWidth || 200, template?.barcodeHeight || 120],
        align: 'center',
      });
    } catch (error) {
      doc.fontSize(8).fillColor('red').text('Unable to render barcode');
      doc.fillColor('black');
    }
    if (i < quantity - 1) doc.addPage();
  }
  doc.end();
  return result;
};

module.exports = {
  renderLabel,
};
