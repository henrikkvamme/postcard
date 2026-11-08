# Fonts

The home page's fonts, served from the site instead of Google Fonts, so the first paint needs no other origin. Each family is under the [SIL Open Font License 1.1](https://openfontlicense.org/):

- Noto Serif Display (the headlines; variable, `wdth` 62.5-100 and `wght` 400-800, upright and italic)
- Pinyon Script (the script word in a headline)
- Inter 400-600, Roboto Flex and JetBrains Mono (the kit's parts)

Only the `latin` and `latin-ext` faces are here. `fonts.css` keeps Google's `unicode-range` for each face, so a browser downloads a file only when the page shows a character in its range.

To fetch them again, ask Google Fonts for the CSS with a current Chrome user agent and keep the `latin` and `latin-ext` blocks:

```
https://fonts.googleapis.com/css2?family=Noto+Serif+Display:ital,wdth,wght@0,62.5..100,400..800;1,62.5..100,400..800&family=Pinyon+Script&family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap
```

`Headline Fallback` in `fonts.css` is a local serif scaled to the condensed headline's width (76.6 percent of Georgia, measured at `font-stretch: 68%`, weight 600). It keeps the headline the same size while Noto Serif Display loads, so the page does not shift.
