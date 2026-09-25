// Shared QVAC translation core.
//
// Both index.js (CLI) and server.js (web UI) import from here, so there is
// exactly one place that talks to the QVAC SDK: one loadModel() call, one
// completion() call, one unloadModel() call. Keeping it in one file means
// the CLI and the web UI can never drift out of sync on how translation
// actually happens.

import { loadModel, completion, unloadModel, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk';

export const MODEL = QWEN3_1_7B_INST_Q4;

export const DIRECTIONS = {
  1: { from: 'English', to: 'Cebuano', label: 'English -> Cebuano' },
  2: { from: 'Cebuano', to: 'English', label: 'Cebuano -> English' }
};

// Known limitation: because Cebuano is low-resource for this model, output
// register and idiom handling can vary between runs and isn't as reliable
// as a dedicated NMT model would be. See README "Known limitations" section.
export function systemPrompt(from, to) {
  return (
    `You are an expert bilingual translator specializing in ${from} and ${to}. ` +
    `Cebuano (also called Bisaya or Sinugboanon) is an Austronesian language spoken ` +
    `by over 20 million people, mainly in Central Visayas and Mindanao, Philippines. ` +
    `Translate the user's ${from} text into natural, fluent, everyday ${to}, preserving ` +
    `tone and meaning. Reply with ONLY the translation -- no explanations, no notes, ` +
    `no transliteration, no quotation marks. /no_think`
  );
}

/**
 * Loads the translation model on-device. Call once per process.
 * @param {(progress: {percentage: number, downloaded: number, total: number}) => void} [onProgress]
 * @returns {Promise<string>} modelId, to pass into translate() and unloadTranslationModel()
 */
export async function loadTranslationModel(onProgress) {
  return loadModel({
    modelSrc: MODEL,
    modelConfig: { ctx_size: 4096 },
    onProgress
  });
}

/**
 * Frees the model. Call once per process, on shutdown.
 * @param {string} modelId
 */
export async function unloadTranslationModel(modelId) {
  return unloadModel({ modelId });
}

/**
 * Translates one piece of text via QVAC's completion() capability.
 * @param {string} modelId
 * @param {string} text
 * @param {'1'|'2'} directionKey - key into DIRECTIONS
 * @param {(chunk: string) => void} [onDelta] - called with each streamed token
 * @returns {Promise<string>} the full, trimmed translation
 */
export async function translate(modelId, text, directionKey, onDelta) {
  const { from, to } = DIRECTIONS[directionKey];
  const history = [
    { role: 'system', content: systemPrompt(from, to) },
    { role: 'user', content: text }
  ];

  const run = completion({ modelId, history, stream: true });

  let out = '';
  for await (const event of run.events) {
    if (event.type === 'contentDelta') {
      out += event.text;
      if (onDelta) onDelta(event.text);
    }
  }
  await run.final;
  return out.trim();
}
