import json
import sys


def _read_with_llmware(path):
    # llmware parser APIs vary by version, so we try known variants.
    try:
        from llmware.parsers import Parser  # type: ignore

        parser = Parser()
        docs = parser.parse(path)
        text_parts = []
        pages = 0
        for d in docs if isinstance(docs, list) else [docs]:
            if not isinstance(d, dict):
                continue
            t = d.get("text") or d.get("content") or ""
            if t:
                text_parts.append(str(t))
            if d.get("page_num") is not None:
                pages = max(pages, int(d.get("page_num") or 0))
        text = "\n".join(text_parts).strip()
        return {"text": text, "pageCount": pages or None}
    except Exception as exc:
        raise RuntimeError(f"llmware parser failed: {exc}") from exc


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "pdf path required"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    result = _read_with_llmware(pdf_path)
    if not result.get("text"):
        print(json.dumps({"error": "no text extracted"}))
        sys.exit(2)
    print(json.dumps(result))


if __name__ == "__main__":
    main()

