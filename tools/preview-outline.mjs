// Quick visual check of the generated country outline: writes reference/v2/india-preview.png
import sharp from 'sharp';
import { countryOutline as c } from '../src/data/countryOutline.js';

const H = 760;
const W = Math.round(H * c.width);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#28272c"/>
  <g transform="scale(${H})"><path d="${c.path}" fill="#e8e8ee" fill-rule="nonzero"/></g>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile('../reference/v2/india-preview.png');
console.log(W, H);
