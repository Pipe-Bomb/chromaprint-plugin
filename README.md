<h1>
    <img src="https://raw.githubusercontent.com/Pipe-Bomb/.github/refs/heads/master/assets/logos/Pipe%20Bomb%20no%20background%20w%20outline.png" width="40" />
    Chromaprint Plugin
</h1>

Uses [Chromaprint](https://acoustid.org/chromaprint) to generate a fingerprint for every track. While collisions aren't uncommon, this provides a pretty good way to identify songs. The generated fingerprint should be the same for multiple files containing the same audio, even at wildly different qualities.

**Requires the `fpcalc` binary to be added to PATH.**

This plugin registers the "chromaprint" track identity, and stores the fingerprint in the format `{DURATION}:{FINGERPRINT}`.

## Installation

Clone the repo into your [Pipe Bomb server's](https://github.com/pipe-bomb/server) `plugins` directory. Then inside, run:

```bash
npm ci
npm run build
```

## Usage

Because `fpcalc` requires an audio stream, tracks that only provide an HLS audio producer are not supported. In most cases, Requesting for the server to cache these tracks will save them as streams, which this plugin can read. As such, it is recommended to use Chromaprint _after_ all HLS tracks have been cached.
