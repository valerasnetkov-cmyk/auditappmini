import { transliterateCyrillicToLatin } from '../src/utils/transliteration.js';

// Different test inputs
const tests = [
  'К569МХ28',  // User entered (with Х)
  'К569МН28',  // Correct for DB (with Н)
];

for (const input of tests) {
  const transliterated = transliterateCyrillicToLatin(input);
  const normalized = transliterated.trim().toUpperCase().replace(/\s+/g, '');
  console.log(`${input} => ${normalized}`);
}