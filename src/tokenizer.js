/**
 * EventMath Tokenizer
 * 
 * Line-oriented tokenizer — one token per line start determines statement type.
 * Multi-word names are allowed; keywords are always reserved.
 */

class EventMathTokenizer {
  /**
   * Tokenize EventMath source code into tokens.
   * @param {string} source - Raw EventMath source
   * @returns {Array<{type: string, value: string, line: number}>}
   */
  tokenize(source) {
    const lines = source.split('\n');
    const tokens = [];
    
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      
      // Skip empty lines and comments
      if (line === '' || line.startsWith('#')) continue;
      
      // Split into words
      const words = this._tokenizeLine(line, i + 1);
      tokens.push(...words);
    }
    
    return tokens;
  }

  /**
   * Tokenize a single line.
   * The line's first word is the primary keyword.
   * Everything after "is" is a literal.
   */
  _tokenizeLine(line, lineNum) {
    const parts = [];
    let current = '';
    let afterIs = false;
    let inLiteral = false;
    const literalWords = [];

    const chars = [...line];
    
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      
      if (afterIs) {
        inLiteral = true;
        // Everything after "is" is literal text
        literalWords.push(line.substring(i).trim());
        break;
      }
      
      if (c === ' ' || c === '\t') {
        if (current) {
          if (current === 'is') {
            afterIs = true;
            // Don't add 'is' as a word — it's the delimiter
            parts.push({ type: 'KEYWORD', value: 'is', line: lineNum });
            // Rest of line is literal
            literalWords.push(line.substring(i + 1).trim());
            break;
          }
          parts.push(this._classifyWord(current, lineNum));
          current = '';
        }
      } else {
        current += c;
      }
    }
    
    // Last word if no "is" on line
    if (!afterIs && current) {
      parts.push(this._classifyWord(current, lineNum));
    }

    // Add the literal text as a LITERAL token
    if (literalWords.length > 0) {
      const literal = literalWords.join('');
      // Remove trailing comments from literal
      const commentIdx = literal.indexOf(' #');
      const cleanLiteral = commentIdx >= 0 ? literal.substring(0, commentIdx).trim() : literal;
      parts.push({ type: 'LITERAL', value: cleanLiteral, line: lineNum });
    }
    
    return parts;
  }

  _classifyWord(word, lineNum) {
    const RESERVED = new Set([
      'event', 'matter', 'category', 'cat', 'layer', 'timeline', 'action',
      'door', 'open', 'closed', 'mark', 'set', 'run', 'when', 'otherwise',
      'split', 'path', 'again', 'walk', 'end', 'is', 'from', 'as', 'to',
      'by', 'with', 'into', 'times', 'past', 'present', 'future', 'stop',
      'merge', 'break', 'add', 'remove', 'before', 'after', 'rewind', 'forward',
      'and',
    ]);

    const scalar = word.toLowerCase();
    
    if (RESERVED.has(scalar)) {
      return { type: 'KEYWORD', value: scalar, line: lineNum };
    }
    
    // Number?
    if (/^\d+(\.\d+)?$/.test(word)) {
      return { type: 'NUMBER', value: word, line: lineNum };
    }

    // Boolean?
    if (word === 'true' || word === 'false') {
      return { type: 'BOOL', value: word, line: lineNum };
    }
    
    // Name (event, mark, action, layer name — multi-word allowed across tokens)
    return { type: 'NAME', value: word, line: lineNum };
  }
}

module.exports = { EventMathTokenizer };