"""Flags passages of the thesis text that share a run of words with an AI example draft.

    python3 scripts/check-ai-overlap.py [thesisDir] [--words 7]

Draft sources: every "#todo[*Example draft, AI-generated ..." block in any .typ file under
thesis/ and thesis-simplified/ (including the _old-chapters backups). Checked text: the
chapters, front matter and appendices of thesisDir (default thesis-simplified), outside
#todo blocks. A hit means: rewrite that passage in your own words (or declare it).
Text Claude suggested only in the chat is not covered.
"""
import glob
import re
import sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
thesis = args[0] if args else "thesis-simplified"
N = int(sys.argv[sys.argv.index("--words") + 1]) if "--words" in sys.argv else 7


def todo_blocks(s):
    """(start, end) of every #todo[...] block, brackets balanced."""
    i = 0
    while True:
        j = s.find("#todo[", i)
        if j < 0:
            return
        d, k = 0, j + 5
        while k < len(s):
            d += s[k] == "["
            d -= s[k] == "]"
            k += 1
            if d == 0:
                break
        yield j, k
        i = k


def words(text):
    text = re.sub(r"@[\w:-]+(\[[^\]]*\])?", " ", text)  # citations and references
    text = re.sub(r"[^\w'’-]+", " ", text.lower())
    return text.split()


# 1. n-grams of every AI draft
grams = set()
for f in glob.glob("thesis/**/*.typ", recursive=True) + glob.glob("thesis-simplified/**/*.typ", recursive=True):
    s = open(f, encoding="utf-8").read()
    for a, b in todo_blocks(s):
        block = s[a:b]
        if "Example draft, AI-generated" in block or "Example, AI-generated" in block:
            w = words(block)
            grams.update(tuple(w[i : i + N]) for i in range(len(w) - N + 1))
print(f"{len(grams)} {N}-word sequences from the AI drafts")

# 2. the thesis text outside todo blocks, line by line
hits = 0
files = sorted(glob.glob(f"{thesis}/chapters/*.typ")) + sorted(glob.glob(f"{thesis}/frontmatter/*.typ")) + [f"{thesis}/appendices/appendices.typ"]
for f in files:
    s = open(f, encoding="utf-8").read()
    for a, b in reversed(list(todo_blocks(s))):
        s = s[:a] + "\n" * s[a:b].count("\n") + s[b:]
    for ln, line in enumerate(s.split("\n"), 1):
        if line.lstrip().startswith(("//", "#", "=", "[", ")")):
            continue
        w = words(line)
        marked = [False] * len(w)
        for i in range(len(w) - N + 1):
            if tuple(w[i : i + N]) in grams:
                for k in range(i, i + N):
                    marked[k] = True
        if any(marked):
            hits += 1
            share = sum(marked) / len(w)
            runs, cur = [], []
            for word, m in zip(w, marked):
                if m:
                    cur.append(word)
                elif cur:
                    runs.append(" ".join(cur))
                    cur = []
            if cur:
                runs.append(" ".join(cur))
            print(f"\n{f.split('/')[-1]}:{ln}  ({share:.0%} of the line's words)")
            for r in runs:
                print(f"    … {r} …")
print(f"\n{hits} lines with overlap" if hits else "\nNo overlap found.")
