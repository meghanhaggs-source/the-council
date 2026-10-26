# AI writing tells — permanent Critic reference

**Scope: all ritualette writing.** Readings, the blueprint dossier, blog, journal, listings, email, app copy. Not scoped to one product and not scoped to one tier.

**Added 2026-08-31** from `inbox/BRIEF-natal-blueprint-pdf-v3.md`. Meghan supplied the diagnostic: <https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing>. The v2 blueprint takeaways failed it, which is what prompted writing this down as a standing reference rather than a one-off fix.

Critic flags these. Critic does not rewrite them.

---

## The eight banned patterns

### 1. Negative parallelism
"not X, it's Y" · "X rather than Y" · "what they did rather than what you hoped" · "X, not Y".

The negation adds nothing the positive statement does not already carry, and it makes every sentence sound like it is correcting a misconception the reader never had. **State the positive instruction alone.**

> ✗ "price the object rather than your time"
> ✓ "price the object"

### 2. Balanced antithesis
"the room to move and the close bond at the same time" · "hold both ends at once" · "depth and speed in the same pair of hands".

Two abstractions joined in a fake tension. It reads as insight and contains none. **Name one concrete behavior instead.**

> ✗ "you need the person and the freedom to move at the same time"
> ✓ "you recharge through your closest person, and you also need to leave, travel, and wander without it counting against the relationship"

### 3. Vague objects
"the specific thing" · "the actual work" · "what's real" · "the material" · "the thing itself" · "what matters".

**An instruction whose object names nothing is not an instruction.** Every imperative needs a real object: a situation type, an artifact, a kind of conversation.

> ✗ "say the specific thing out loud"
> ✓ "ask for those plans by name, out loud, before you agree to shared ones"

### 4. Rule of three
Triplet lists of adjectives, benefits, or takeaways: "steadily, physically, and for keeps" · "taste, intuition, and artistic depth" · "generous, serious, and deep".

The third item is almost always there for cadence rather than for content. **Use one item or two.**

### 5. Empty trailing -ing clauses
"…, improving convenience" · "…, deepening the bond" · "…, making it durable".

The clause hangs off the sentence with no subject and adds a claim nobody has to defend. **Cut it, or make it its own sentence with a concrete subject.**

### 6. Significance inflation
"this is the important part" · "worth naming" · "plays a vital role" · "it is worth saying that" · "crucially" · "notably".

**If it matters, the content shows it.** Announcing importance is what writing does when it does not have the goods.

### 7. Compulsive summarizing
"in essence" · "ultimately" · "at its core" · "in summary" · "all in all" · "the key takeaway is".

The reading does not need a narrator recapping it. **"in short" closers survive only as one concrete sentence** where the product spec calls for one.

### 8. Process narration
"this dossier maps…" · "the rest of this reading covers…" · "as we saw above" · "this section explains…".

**Every sentence is about the client**, never about the document they are holding.

---

## The concreteness test (the positive rule)

The banned list says what to stop doing. This says what to do.

> **Every instruction must pass: could the client do this on a specific day, and know afterward whether they did it?**

That requires **at least one concrete noun per instruction** — a situation type, a number, a timespan, an artifact, or a kind of conversation.

| abstract | passes the test |
|---|---|
| "protect your private hours" | "block two mornings a week where nothing is scheduled and nobody has your calendar" |
| "set the standard before you begin" | "write the finish condition in one line at the top of the file before you start" |
| "sell the object" | "put a price and a cap on the page, and stop quoting hourly" |
| "check in with your partner" | "ask for your own travel dates by name before you agree to shared plans" |

---

## Calibration: a failing takeaway, rewritten

**v2, fails.** Balanced antithesis, vague object, negative parallelism twice:

> "protect the room to move and the close bond at the same time, because your chart does not make you trade one for the other. say the specific thing out loud instead of assuming it is understood. once a month, check what the person actually did rather than what you hoped they meant."

**v3 target register.** Same astrology, same advice, every noun concrete, no banned pattern:

> "your moon sits in your partnership house, in sagittarius: you recharge through your closest person, and you also need to leave, travel, and wander without it counting against the relationship. ask for those plans by name, out loud, before you agree to shared ones. an unspoken plan reads to a partner as no plan."

---

## How Critic applies this

- Run the full list against **callouts, roadmap blocks, and body prose**.
- Run the **concreteness test on every imperative sentence**.
- **Flags only, phrased as questions.** Critic never rewrites.
- `pods/production/blueprint_qa.py` settles the mechanically detectable part of this list for the blueprint. The judgment calls (is this metaphor earned, is this object concrete enough to act on) stay with the human pass.
