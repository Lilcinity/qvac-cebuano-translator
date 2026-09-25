// QVAC Cebuano Translator -- CLI
//
// An offline English <-> Cebuano (Bisaya) translator that runs entirely
// on-device using Tether's QVAC SDK. No API key, no cloud calls, nothing
// leaves this machine.
//
// Why completion() instead of translate()?
// QVAC's dedicated NMT engines (Bergamot / nmt.cpp) ship models for dozens
// of languages, but Cebuano is not one of them yet -- it's a low-resource
// language with no publicly available offline NMT checkpoint. Instead, this
// app loads a small multilingual instruction-tuned LLM (Qwen3 1.7B) and uses
// QVAC's completion() capability with a translation-only system prompt. This
// is one of the officially supported QVAC AI tasks, and it's the practical
// way to cover a low-resource language pair fully offline today.
//
// Usage:
//   node index.js            interactive CLI
//   node index.js --demo     non-interactive demo (both directions, then exit)
//   node server.js           web UI instead of the CLI (see README)

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { DIRECTIONS, loadTranslationModel, translate, unloadTranslationModel } from './lib/qvac.js';

const DEMO_SENTENCES = {
  1: 'Hello! Running artificial intelligence locally on your device protects your privacy.',
  2: 'Maayong buntag! Kumusta ka karon? Naglaom ko nga malipayon ang imong adlaw.'
};

function onProgress(p) {
  const mb = (n) => (n / 1e6).toFixed(1);
  const line = `  downloading model: ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`;
  process.stderr.write(process.stderr.isTTY ? `\r${line}` : `${line}\n`);
  if (p.percentage >= 100) process.stderr.write('\n');
}

async function runDemo(modelId) {
  for (const key of Object.keys(DIRECTIONS)) {
    const { label } = DIRECTIONS[key];
    const text = DEMO_SENTENCES[key];
    console.log(`\n=== ${label} ===`);
    console.log(`Source: "${text}"`);
    process.stdout.write('Translation: ');
    await translate(modelId, text, key, (chunk) => process.stdout.write(chunk));
    console.log('');
  }
}

async function runInteractive(modelId) {
  const rl = readline.createInterface({ input, output });

  console.log('\nType a sentence to translate it. Type "q" at the direction prompt to quit.\n');

  while (true) {
    const dirAnswer = (
      await rl.question('Direction  [1] English -> Cebuano   [2] Cebuano -> English   [q] Quit: ')
    ).trim();

    if (dirAnswer.toLowerCase() === 'q') break;
    if (!DIRECTIONS[dirAnswer]) {
      console.log('Please enter 1, 2, or q.\n');
      continue;
    }

    const text = (await rl.question('Text: ')).trim();
    if (!text) continue;

    process.stdout.write('\nTranslation: ');
    await translate(modelId, text, dirAnswer, (chunk) => process.stdout.write(chunk));
    console.log('\n');
  }

  rl.close();
}

async function main() {
  const demoMode = process.argv.includes('--demo');

  console.log('');
  console.log('================================================');
  console.log('   QVAC CEBUANO TRANSLATOR');
  console.log('   English <-> Cebuano (Bisaya), fully on-device');
  console.log('================================================');
  console.log('');
  console.log('Loading translation model on-device (Qwen3 1.7B)...');

  const modelId = await loadTranslationModel(onProgress);

  console.log('Model loaded. All inference below runs locally -- no cloud, no API key.');

  if (demoMode) {
    await runDemo(modelId);
  } else {
    await runInteractive(modelId);
  }

  await unloadTranslationModel(modelId);
  console.log('Model unloaded. Salamat sa paggamit! (Thanks for using it!)');
}

main().catch((error) => {
  console.error('\n✖ Error:', error);
  process.exit(1);
});
