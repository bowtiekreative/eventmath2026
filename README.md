# EventMath

A programming language where **time is a first-class language construct**.

> Events, layers, timelines, doors, and the Mender debugger — designed for readability, built for speed, compiled to plain JavaScript.

## Structure

```
eventmath2026/
├── spec/               # Language specification
├── src/                # Compiler source
│   ├── tokenizer.js
│   ├── parser.js
│   ├── codegen.js
│   └── formatter.js
├── runtime/            # <10KB runtime
│   └── eventmath.js
├── tests/              # Acceptance programs
└── mender/             # The Mender debugger
```

## Branches

| Branch | Deliverable |
|---|---|
| `main` | Foundation |
| `branch-1-initial-spec` | Language spec + project structure |
| `branch-2-grammar-parser` | Tokenizer + parser |
| `branch-3-code-generator` | JS code generator |
| `branch-4-runtime` | <10KB runtime |
| `branch-5-formatter` | Formatter + error catalog |
| `branch-6-acceptance-tests` | Three acceptance programs |
| `branch-7-mender` | Mender fast-path debugger |