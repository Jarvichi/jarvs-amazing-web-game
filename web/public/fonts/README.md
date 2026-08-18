# Fonts

Self-hosted `woff2` faces backing the `--font-display` / `--font-body` / `--font-mono`
tokens in `styles.css` (see `@font-face` declarations near the top of that file). All
three are self-hosted (not loaded from a CDN) so the PWA works offline.

| File | Font | Token | Licence |
|---|---|---|---|
| `cinzel-variable.woff2` | [Cinzel](https://github.com/NDISCOVER/Cinzel) (variable, weights 400-900) | `--font-display` | `cinzel-OFL.txt` |
| `spectral-regular.woff2` | [Spectral](https://github.com/productiontype/Spectral) | `--font-body` | `spectral-OFL.txt` |
| `jetbrains-mono-regular.woff2` | [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | `--font-mono` | `jetbrains-mono-OFL.txt` |

All three are licensed under the SIL Open Font License 1.1 — see the `*-OFL.txt` file
next to each. Latin-only subsets, sourced from Google Fonts' `gstatic` CDN.
