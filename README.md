# BIOL 40B — Lab Exam 2 Spelling Drill

A free, browser-based **typing** drill for BIOL 40B Lab Exam 2 (cardiovascular
and respiratory systems). A pin is highlighted on the slide; you type what it
is. 19 stations, 121 structures, and **spelling counts**.

Made by students, for students — this is a study aid, not official course
material, and it is not affiliated with or endorsed by the instructor.

Everything runs client-side. No server, no build step, no accounts, no
tracking — open `index.html` and it works, including offline once loaded.

This is the companion to the [labeling
app](https://producer456.github.io/bio40b-lab-exam-2-labeling/), which is a
separate site: there you drag terms onto pins, here you spell them from memory.
The two share the same figures and the same answer key.

## Modes

### Practice

One pin at a time. Type the structure's name exactly — case, spaces and
punctuation are free, but the letters are not.

A wrong answer is sorted into one of three kinds, because they need different
help:

- **A different structure.** Type *bicuspid* for the tricuspid valve and it
  names what you actually described and says whether it's on this image or
  another station. A real anatomical mix-up is never excused as a typo.
- **The right structure, misspelt.** *epiglotis* gets "check your spelling"
  plus your own attempt marked letter by letter: red for a wrong letter, struck
  through for one too many, and a caret where a letter is missing. It shows
  *where*, not *what*, so you still have to produce it. Transpositions are
  called out as such.
- **Neither.** A plain miss; after two of them hints start arriving unasked.

**Hint** escalates: the structure's function, then its shape
(`L___ (4) a_____ (6)`), then every other letter. **Show answer** files the pin
under "review my misses".

Decks: all 121 in order, shuffled, a single station, or only the ones you've
missed. Scores live in `localStorage` and an ordered deck resumes where you left
it. The end-of-deck summary offers to re-drill just the misses.

Wording that isn't a spelling difference is accepted: *mitral valve*, *AV node*,
*primary bronchus*, *red blood cells*, singular/plural.

### Test

The practical, simulated. **Two minutes a station** (1/2/3/5 selectable), and
you rotate when the clock says so rather than when you're finished.

No hints, no answers, nothing marked until the buzzer. Enter banks an answer and
moves on; **Back**/**Next** move around the station freely so you can return to
a hard pin. At `0:00` — or on **Finish station** — the station is graded and
frozen, and a card shows every pin, what you wrote, and whether it counted.

The final report scores each station on a bar and lists every miss with what you
actually typed. **Practise these** drops the misses straight into practice mode.

### Teacher

Pin correction, in place. The station's pins all appear at once: drag a **pin**
to move where it points, drag a **label** to move its text (the leader line
follows). **Save answer key** commits the station, **Undo my edits** reverts to
the last save, **Restore original key** reloads the pins that ship with the app.

Saving writes the same `localStorage` key the labeling app reads. Both sites are
served from `producer456.github.io`, so they share that storage and a pin fixed
here is fixed there. This is positions only — to add, delete or re-assign a pin,
use Teacher Mode in the labeling app.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The page |
| `spell.js` | The drill engine — matching, hints, decks, timer, pin editing |
| `spell.css` | Drill styles, layered on `styles.css` |
| `styles.css` | Shared base styles, from the labeling app |
| `data.js` | Stations, word banks, the answer key, credits |
| `images/` | The figures |

`data.js`, `styles.css` and `images/` are copied from the labeling app, whose
generator builds them from the source practical materials. They are committed
here so this site stands alone.

## Answer-key backup

`backup/bio40b-lab-exam-2-answer-key-verified-2026-07-27.json` is the verified
key — 19 stations, 121 pins — in the labeling app's own backup format. Feed it
to that app's **Import Data** button to restore a device whose saved key has
been lost or corrupted; it overwrites the stored key and canvas with these
positions. It was generated from `PRESET_KEYS` in `data.js` and checked
field-for-field against a browser whose stations had all been reset with
*Restore Original Key*, then verified by importing it into an empty browser.

## Image credits

Figures come from several sources under different licences — several are
CC BY 4.0 / CC BY 3.0 / CC BY-SA 4.0, which **require attribution regardless of
how the app is used**. The full list is in the "Image credits & licensing" panel
at the bottom of the page, and in `CREDITS` in `data.js`.

Some figures' sources were not individually recorded. They are labelled as such.
If you hold the rights to one of them, please open an issue — it will be
credited or removed on request.

Because the figures carry their own licences, they are **not** covered by any
licence this repository might apply to its code.

## A note for students

The answer key ships in `data.js` in plain text, since the whole app runs in the
browser. It is a study aid, not an assessment tool — nothing here is secret from
anyone willing to open the file.
