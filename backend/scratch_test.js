import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { generateSmartUploadBundle } from './services/smartBundle.js';

async function test() {
  try {
    const text = 'This is a test document about the mitochondria, the powerhouse of the cell.';
    const result = await generateSmartUploadBundle('Biology', text);
    console.log('SUCCESS!');
    console.log(result);
  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
  }
}

test();
