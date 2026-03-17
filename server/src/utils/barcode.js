const bwipjs = require('bwip-js');

const generateBarcode = async ({ symbology = 'code128', text }) => {
  const buffer = await bwipjs.toBuffer({
    bcid: symbology,
    text,
    scale: 3,
    height: 10,
    includetext: true,
  });
  return buffer;
};

module.exports = {
  generateBarcode,
};
