"""
Local RAG corpus retrieval. Extend with full llmware indexing when models/embeddings are configured.
Usage: python rag_cli.py retrieve "<query>" [topics|interview|jd] [k]
"""
import json
import os
import sys
import glob


def _keyword_score(query: str, text: str) -> int:
    q = {w for w in query.lower().replace(",", " ").split() if len(w) > 2}
    words = text.lower().replace(",", " ").split()
    return sum(1 for w in words if w in q)


def retrieve(query: str, k: int):
    base = os.path.dirname(os.path.abspath(__file__))
    chunks = []
    for sub in ("corpus",):
        for ext in ("**/*.md", "**/*.txt"):
            pattern = os.path.join(base, sub, ext)
            for path in glob.glob(pattern, recursive=True):
                try:
                    with open(path, encoding="utf-8") as f:
                        body = f.read()
                except OSError:
                    continue
                chunks.append({"source": path, "text": body[:8000]})

    try:
        from llmware.library import Library  # noqa: F401 — presence check for llmware install

        _ = Library  # integrate DocumentParse / embeddings here when ready
    except Exception:
        pass

    scored = sorted(chunks, key=lambda c: _keyword_score(query, c["text"]), reverse=True)
    out = []
    seen = set()
    for c in scored:
        if c["source"] in seen:
            continue
        seen.add(c["source"])
        out.append({"source": c["source"], "text": c["text"][:6000]})
        if len(out) >= k:
            break
    return out


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "retrieve":
        print(json.dumps({"chunks": [], "error": "usage: rag_cli.py retrieve <query> [mode] [k]"}))
        return

    query = sys.argv[2]
    _mode = sys.argv[3] if len(sys.argv) > 3 else "topics"
    k = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    chunks = retrieve(query, k)
    print(json.dumps({"chunks": chunks}))


if __name__ == "__main__":
    main()
