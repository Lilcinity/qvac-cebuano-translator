# QVAC Cebuano Translator

An offline English &harr; Cebuano (Bisaya) translator powered by Tether's [QVAC SDK](https://qvac.tether.io). All inference runs locally on your machine, with no API key, no cloud calls, and no data leaving your device.

Cebuano (Sinugboanon), also known as Bisaya, is spoken by over 20 million people across the Central Visayas and Mindanao regions of the Philippines &mdash; but it's a low-resource language for machine translation. There is no public offline NMT model for it yet, so this app takes a different route: it loads a small multilingual LLM and uses QVAC's `completion()` capability with a translation-only system prompt to cover the pair anyway, fully on-device.

## Features

- English &rarr; Cebuano and Cebuano &rarr; English, in one interactive session
- 100% on-device inference &mdash; no server, no API key, nothing leaves your machine
- Uses Tether's QVAC SDK (`loadModel` + `completion` + `unloadModel`)
- Streams tokens live to the terminal as they're generated
- Simple command-line interface, plus a non-interactive `--demo` mode

## Why `completion()` instead of `translate()`?

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

## Usage

Interactive mode:

```bash
npm start
```

You'll be asked to pick a direction, then enter text:

```
Direction  [1] English -> Cebuano   [2] Cebuano -> English   [q] Quit: 1
Text: Where is the nearest market?

Translation: Asa ang pinakaduol nga merkado?
```

Non-interactive demo (translates one sample sentence in each direction, then exits &mdash; useful for a quick screen recording):

```bash
npm run demo
```

The first run downloads the model (a few hundred MB to ~1 GB depending on quantization); every run after that loads it from the local QVAC cache and needs no network access at all.

## How it works

1. `loadModel()` loads `QWEN3_1_7B_INST_Q4` on-device.
2. Each translation request builds a two-message `history`: a `system` message that pins the model to translator-only behavior for the chosen language pair, and a `user` message with the text to translate.
3. `completion({ modelId, history, stream: true })` streams the translation back token by token via `run.events`.
4. `unloadModel()` frees the model from memory when the session ends.

See [`index.js`](./index.js) for the full implementation.

## QVAC function calls (source references)

The three required SDK calls, linked directly to the exact lines that make them:

| Call | Location |
|---|---|
| `import { loadModel, completion, unloadModel, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk'` | [index.js#L20](https://github.com/Lilcinity/qvac-cebuano-translator/blob/f41fa0c5c7a94a1bdb6842c933535e5578d8df1f/index.js#L20) |
| `loadModel({ modelSrc: QWEN3_1_7B_INST_Q4, ... })` | [index.js#L122-L126](https://github.com/Lilcinity/qvac-cebuano-translator/blob/f41fa0c5c7a94a1bdb6842c933535e5578d8df1f/index.js#L122-L126) |
| `completion({ modelId, history, stream: true })` | [index.js#L59](https://github.com/Lilcinity/qvac-cebuano-translator/blob/f41fa0c5c7a94a1bdb6842c933535e5578d8df1f/index.js#L59) |
| `unloadModel({ modelId })` | [index.js#L136](https://github.com/Lilcinity/qvac-cebuano-translator/blob/f41fa0c5c7a94a1bdb6842c933535e5578d8df1f/index.js#L136) |

## Known limitations: translation quality is inconsistent

Being upfront about this: because there's no dedicated NMT checkpoint for Cebuano, this app leans on a general-purpose multilingual LLM through `completion()`, and that trade-off shows up in the output. Specific issues observed while testing both directions:

- **Register drifts between runs.** The same English sentence translated twice can come back once in fairly formal/"deep" Sinugboanon and once in casual Bisaya slang, because sampling isn't deterministic and Cebuano has much less training data to anchor a consistent register than English does.
- **Code-switching is handled unevenly.** Real spoken Cebuano mixes in a lot of English and Tagalog loanwords. The model sometimes over-corrects into overly formal Cebuano a native speaker wouldn't actually use, and sometimes leaves English words untranslated instead of picking the natural Cebuano equivalent.
- **Idioms often come out literal.** English figures of speech get calque-translated word-for-word more often than they're mapped to an equivalent Cebuano expression, simply because there isn't enough parallel idiom data for this pair.
- **Short, context-free input is the weakest case.** Cebuano relies heavily on particles (`na`, `pa`, `gyud`, `man`, etc.) and context to disambiguate meaning; single words or short fragments (in either direction) are where mistranslations are most likely.
- **No confidence signal.** A real NMT model can expose beam/confidence scores. `completion()` gives you fluent-looking text either way, so a wrong translation doesn't "look" any less confident than a correct one &mdash; don't take fluency as a proxy for accuracy.

Cebuano &rarr; English is generally the more reliable direction, since English dominates the model's training data on the output side. Treat this as a good tool for everyday phrases and getting the gist, not as a substitute for a native speaker or a professional translator for anything official, legal, or medical.

## License

MIT &mdash; see [LICENSE](./LICENSE).
