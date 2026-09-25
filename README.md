# QVAC Cebuano Translator

An offline English &harr; Cebuano (Bisaya) translator powered by Tether's [QVAC SDK](https://qvac.tether.io). All inference runs locally on your machine, with no API key, no cloud calls, and no data leaving your device.

Cebuano (Sinugboanon), also known as Bisaya, is spoken by over 20 million people across the Central Visayas and Mindanao regions of the Philippines &mdash; it remains a low-resource language for machine translation. No public offline NMT model for it yet, so this app takes a different route: it loads a small multilingual LLM. It uses QVAC's `completion()` capability with a translation-only system prompt to cover the pair anyway, fully on-device.

## Features

- English &rarr; Cebuano and Cebuano &rarr; English, in one session

- Two front ends sharing one on-device core: a terminal CLI and a local browser UI

- 100% on-device inference &mdash; no server, no API key, nothing leaves your machine

- Uses Tether's QVAC SDK (`loadModel` + `completion` + `unloadModel`)

- Streams tokens live as they're generated, in the terminal or in the browser

- Non-interactive `--demo` mode for quick screenshots/recordings

## Why use `completion()` instead of `translate()`?

QVAC's dedicated NMT engines (Bergamot / nmt.cpp) already ship offline models for dozens of language pairs. Cebuano isn't one of them yet. Rather than skip the language, this app loads `QWEN3_1_7B_INST_Q4` &mdash; a small, multilingual, instruction-tuned LLM &mdash; and drives it with a strict translation-only system prompt through QVAC's `completion()` API. `completion()` is one of QVAC's core supported AI tasks, and this is a practical way to add offline support for a low-resource language today, without needing a dedicated NMT checkpoint.

## SDK version

Built and tested against **`@qvac/sdk` `0.20.0`** (declared as `^0.20.0` in [`package.json`](./package.json)).

## Requirements

- Node.js 22.17+
- npm
- Internet connection for the initial model download (subsequent runs use the cached model and work fully offline)

## Installation

Clone the repository:

```bash
git clone https://github.com/Lilcinity/qvac-cebuano-translator.git
cd qvac-cebuano-translator
npm install
```

## Project structure

```
lib/qvac.js       shared core: the only file that calls @qvac/sdk
                  (loadModel, completion, unloadModel)
index.js          CLI front end, imports lib/qvac.js
server.js         web UI front end, imports lib/qvac.js
public/index.html the browser page server.js serves
```

The CLI and the web UI are two front ends over the same on-device pipeline &mdash; neither one talks to `@qvac/sdk` directly, they both go through `lib/qvac.js`.

## Usage of QVAC Cebuano Translator

### CLI

Interactive mode:

```bash
npm start
```

You'll be asked to pick a direction, then enter text:
Example:

```
Direction  [1] English -> Cebuano   [2] Cebuano -> English   [q] Quit: 1

Text: Where is the nearest market?

Translation: Asa ang pinakaduol nga merkado?
```

Non-interactive demo (translates one sample sentence in each direction, then exits.

```bash
npm run demo
```

### Web UI

```bash
npm run web
```

Then open **http://localhost:5173** in your browser. Type a sentence, hit Translate (or Ctrl/Cmd+Enter), and it streams back the same way the CLI does &mdash; because it's calling the same `lib/qvac.js` functions underneath. Use the swap button to flip direction; the "On-device" badge is just there as a reminder that nothing is calling out to a cloud API.

The first run of either front end downloads the model (a few hundred MB to ~1 GB depending on quantization). Every run after that loads it from the local QVAC cache, so it needs no network access at all.

## How it works

All of this lives in `lib/qvac.js`; `index.js` and `server.js` are just two thin front ends that call it:

1. `loadTranslationModel()` calls `loadModel()` to load `QWEN3_1_7B_INST_Q4` on-device, once at startup.

2. `translate()` builds a two-message `history` per request: a `system` message that pins the model to translator-only behavior for the chosen language pair, and a `user` message with the text to translate.

3. `completion({ modelId, history, stream: true })` streams the translation back token by token via `run.events`; both front ends forward those tokens as they arrive (to `stdout` in the CLI, over the HTTP response in the web UI).

4. `unloadTranslationModel()` calls `unloadModel()` to free the model when the session ends.

## QVAC function calls (source references)

The three required SDK calls all live in one place, [`lib/qvac.js`](./lib/qvac.js), linked directly to the exact lines that make them:

| Call | Location |
|---|---|
| `import { loadModel, completion, unloadModel, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk'` | [lib/qvac.js#L9](https://github.com/Lilcinity/qvac-cebuano-translator/blob/7e313a9cd9cf4a0453460fea6eca0dbc1c5d7b20/lib/qvac.js#L9) |
| `loadModel({ modelSrc: MODEL, ... })` | [lib/qvac.js#L38-L42](https://github.com/Lilcinity/qvac-cebuano-translator/blob/7e313a9cd9cf4a0453460fea6eca0dbc1c5d7b20/lib/qvac.js#L38-L42) |
| `completion({ modelId, history, stream: true })` | [lib/qvac.js#L68](https://github.com/Lilcinity/qvac-cebuano-translator/blob/7e313a9cd9cf4a0453460fea6eca0dbc1c5d7b20/lib/qvac.js#L68) |
| `unloadModel({ modelId })` | [lib/qvac.js#L50](https://github.com/Lilcinity/qvac-cebuano-translator/blob/7e313a9cd9cf4a0453460fea6eca0dbc1c5d7b20/lib/qvac.js#L50) |

## Known limitations: translation quality is inconsistent

To be transparent/upfront: because there's no dedicated NMT checkpoint for Cebuano, this app relies on a general-purpose multilingual LLM via a QVAC `completion()` function, and that trade-off shows up in the output. Specific issues observed while testing both directions:

- **Register drifts between runs.** The same English sentence translated twice can come back once in fairly formal/"deep" Sinugboanon and once in casual Bisaya slang, because sampling isn't deterministic and Cebuano has much less training data to anchor a consistent register than English does.
  
- **Code-switching is handled unevenly.** Real spoken Cebuano mixes in a lot of English and Tagalog loanwords. The model sometimes over-corrects into overly formal Cebuano a native speaker wouldn't typically use, and sometimes leaves English words untranslated instead of picking the natural Cebuano equivalent.
  
- **Idioms often come out literal.** English figures of speech get calque-translated word-for-word more than they're mapped to an equivalent Cebuano expression, simply because there isn't enough parallel idiom data for this pair.
  
- **Short, context-free input is the weakest case.** Cebuano relies heavily on particles (`na`, `pa`, `gyud`, `man`, etc.) and context to disambiguate meaning; single words or short fragments (in either direction) are where mistranslations are most likely.
  
- **No confidence signal.** A real NMT model can expose beam/confidence scores. `completion()` gives you fluent-looking text either way, so a wrong translation doesn't "look" any less confident than a correct one &mdash; don't take fluency as a proxy for accuracy.

Cebuano &rarr; English is generally more reliable direction, since English dominates the model's training data on the output side. Treat this as a good tool for everyday phrases and getting the gist, not as a substitute for a native speaker or a professional translator for anything official, legal, or medical.

## Troubleshooting

**`Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@qvac/sdk'`**

This means Node is running `index.js` (or `server.js`) on its own, outside the project &mdash; commonly because only that one file was downloaded (e.g. from a browser's "Save As" into `Downloads`), without `package.json` and without running `npm install`. `@qvac/sdk` is a dependency declared in `package.json`; it only exists once npm has installed it into a `node_modules` folder next to that `package.json`.

Fix: don't run a lone downloaded file. Clone (or download) the *whole* repository, then from inside that folder:

```bash
cd qvac-cebuano-translator
npm install
npm start
```

If `node_modules` already exists but the error persists, you're likely running the command from the wrong directory &mdash; `cd` into the folder that contains `package.json` first.

## License

MIT &mdash; see [LICENSE](./LICENSE).
