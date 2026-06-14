'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

// The extension lives at vscode-eventmath/src/extension.js inside the repo.
// The repo root is two levels up.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EM_BIN    = path.join(REPO_ROOT, 'bin', 'em');

function requireEM(mod) {
  return require(path.join(REPO_ROOT, 'src', mod));
}

function activate(context) {
  const output = vscode.window.createOutputChannel('EventMath');

  // ── Format document provider ────────────────────────────────────────────────
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    { language: 'eventmath' },
    {
      provideDocumentFormattingEdits(document) {
        try {
          const { EventMathTokenizer } = requireEM('tokenizer.js');
          const { EventMathParser }    = requireEM('parser.js');
          const { EventMathFormatter } = requireEM('formatter.js');

          const src = document.getText();
          const tokens = new EventMathTokenizer().tokenize(src);
          const ast    = new EventMathParser(tokens).parse();

          if (ast.errors && ast.errors.length > 0) {
            const msg = ast.errors.map(e => (typeof e === 'string' ? e : e.message)).join('; ');
            vscode.window.showErrorMessage(`EventMath: cannot format — ${msg}`);
            return [];
          }

          const formatted = new EventMathFormatter().format(ast) + '\n';
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(src.length)
          );
          return [vscode.TextEdit.replace(fullRange, formatted)];
        } catch (e) {
          vscode.window.showErrorMessage(`EventMath formatter: ${e.message}`);
          return [];
        }
      }
    }
  );

  // ── Check command ────────────────────────────────────────────────────────────
  const checkCmd = vscode.commands.registerCommand('eventmath.check', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'eventmath') {
      vscode.window.showWarningMessage('EventMath: open an .em file first');
      return;
    }

    output.clear();
    output.show(true);

    try {
      const { EventMathTokenizer } = requireEM('tokenizer.js');
      const { EventMathParser }    = requireEM('parser.js');
      const { EventMathValidator } = requireEM('validator.js');

      const src    = editor.document.getText();
      const tokens = new EventMathTokenizer().tokenize(src);
      const ast    = new EventMathParser(tokens).parse();

      if (ast.errors && ast.errors.length > 0) {
        for (const err of ast.errors) {
          const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
          output.appendLine(`Parse error: ${msg}`);
        }
        vscode.window.showErrorMessage(`EventMath: ${ast.errors.length} error(s) — see EventMath output`);
        return;
      }

      const validation = new EventMathValidator().validate(ast);
      let hasIssues = false;

      for (const e of (validation.errors || [])) {
        output.appendLine(`Error: ${e}`);
        hasIssues = true;
      }
      for (const w of (validation.warnings || [])) {
        output.appendLine(`Warning: ${w}`);
        hasIssues = true;
      }

      if (!hasIssues) {
        output.appendLine(`✓  ${path.basename(editor.document.fileName)} — valid (${ast.statements.length} statements)`);
        vscode.window.showInformationMessage('EventMath: file is valid');
      } else {
        vscode.window.showWarningMessage('EventMath: validation issues — see EventMath output');
      }
    } catch (e) {
      output.appendLine(`Internal error: ${e.message}`);
      vscode.window.showErrorMessage(`EventMath check failed: ${e.message}`);
    }
  });

  // ── Run command ──────────────────────────────────────────────────────────────
  const runCmd = vscode.commands.registerCommand('eventmath.run', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showWarningMessage('EventMath: open a file first'); return; }

    if (editor.document.isDirty) {
      await editor.document.save();
    }

    const file     = editor.document.fileName;
    const nodePath = vscode.workspace.getConfiguration('eventmath').get('nodePath', 'node');
    const cmd      = `${nodePath} "${EM_BIN}" run "${file}"`;

    let terminal = vscode.window.terminals.find(t => t.name === 'EventMath');
    if (!terminal) terminal = vscode.window.createTerminal('EventMath');
    terminal.show();
    terminal.sendText(cmd);
  });

  // ── Compile command ──────────────────────────────────────────────────────────
  const compileCmd = vscode.commands.registerCommand('eventmath.compile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { vscode.window.showWarningMessage('EventMath: open a file first'); return; }

    if (editor.document.isDirty) {
      await editor.document.save();
    }

    const file     = editor.document.fileName;
    const nodePath = vscode.workspace.getConfiguration('eventmath').get('nodePath', 'node');
    const target   = vscode.workspace.getConfiguration('eventmath').get('target', 'node');
    const cmd      = `${nodePath} "${EM_BIN}" compile --target ${target} "${file}"`;

    let terminal = vscode.window.terminals.find(t => t.name === 'EventMath');
    if (!terminal) terminal = vscode.window.createTerminal('EventMath');
    terminal.show();
    terminal.sendText(cmd);
  });

  context.subscriptions.push(
    formattingProvider,
    checkCmd,
    runCmd,
    compileCmd,
    output
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
