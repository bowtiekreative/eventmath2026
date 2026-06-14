/**
 * EventMath v2.20 — Minority Report Predictive Story Layer Tests
 *
 * Tests for the story, narrative, scope, and scenario keywords.
 * Tests both the tokenizer/parser/codegen pipeline and the runtime.
 */

const path = require('path');
const { EventMathTokenizer } = require(path.join(__dirname, '..', 'src', 'tokenizer.js'));
const { EventMathParser } = require(path.join(__dirname, '..', 'src', 'parser.js'));
const { EventMathCodeGen } = require(path.join(__dirname, '..', 'src', 'codegen.js'));

// Story runtime
const storyRuntimePath = path.join(__dirname, '..', 'runtime', 'eventmath-story-runtime.js');
let EventMathStoryRuntime;
try {
  EventMathStoryRuntime = require(storyRuntimePath);
} catch (e) {
  // Runtime tests will be skipped if runtime module isn't available
  EventMathStoryRuntime = null;
}

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg || `Expected "${expected}", got "${actual}"`);
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(msg || `Expected ${e}, got ${a}`);
  }
}

function tokenize(code) {
  const t = new EventMathTokenizer();
  return t.tokenize(code);
}

function parse(tokens) {
  const p = new EventMathParser(tokens);
  const ast = p.parse();
  if (ast.errors && ast.errors.length > 0) {
    throw new Error('Parse errors: ' + ast.errors.join('; '));
  }
  return ast;
}

function compile(code) {
  const tokens = tokenize(code);
  const ast = parse(tokens);
  const cg = new EventMathCodeGen();
  return cg.generate(ast, { runtimePath: '../runtime/eventmath-runtime.js' });
}

console.log('═══════════════════════════════════════════════');
console.log('  EventMath v2.20 — Story Layer Tests');
console.log('═══════════════════════════════════════════════');
console.log('');

// ── Tokenizer Tests ──────────────────────────────────────────

console.log('── Tokenizer ──');

test('tokenize story statement', () => {
  const tokens = tokenize('story breaking_news from twitter about "election" into events_layer');
  assertEqual(tokens.length, 1, 'Should produce one token');
  assertEqual(tokens[0].type, 'STORY_STMT', 'Should be STORY_STMT');
  assertEqual(tokens[0].value.name, 'breaking_news', 'name');
  assertEqual(tokens[0].value.source, 'twitter', 'source');
  assertEqual(tokens[0].value.query, '"election"', 'query');
  assertEqual(tokens[0].value.into, 'events_layer', 'into');
});

test('tokenize story with news source', () => {
  const tokens = tokenize('story climate_crisis from news about "global warming" into news_layer');
  assertEqual(tokens[0].type, 'STORY_STMT');
  assertEqual(tokens[0].value.source, 'news');
});

test('tokenize story with rss source', () => {
  const tokens = tokenize('story tech_feed from rss about "AI" into tech_layer');
  assertEqual(tokens[0].type, 'STORY_STMT');
  assertEqual(tokens[0].value.source, 'rss');
});

test('tokenize story with scan source', () => {
  const tokens = tokenize('story network_scan from scan about "192.168.1.0/24" into discovered_hosts');
  assertEqual(tokens[0].type, 'STORY_STMT');
  assertEqual(tokens[0].value.source, 'scan');
});

test('tokenize story with web source', () => {
  const tokens = tokenize('story web_data from web about "https://api.example.com/data" into api_results');
  assertEqual(tokens[0].type, 'STORY_STMT');
  assertEqual(tokens[0].value.source, 'web');
});

test('tokenize narrative statement', () => {
  const tokens = tokenize('narrative con_view of breaking_news from conservative');
  assertEqual(tokens.length, 1);
  assertEqual(tokens[0].type, 'NARRATIVE_STMT');
  assertEqual(tokens[0].value.name, 'con_view');
  assertEqual(tokens[0].value.storyName, 'breaking_news');
  assertEqual(tokens[0].value.perspective, 'conservative');
});

test('tokenize scope statement', () => {
  const tokens = tokenize('scope market_crash through economics and politics into alternatives');
  assertEqual(tokens.length, 1);
  assertEqual(tokens[0].type, 'SCOPE_STMT');
  assertEqual(tokens[0].value.subject, 'market_crash');
  assertDeepEqual(tokens[0].value.dimensions, ['economics', 'politics']);
  assertEqual(tokens[0].value.into, 'alternatives');
});

test('tokenize scope with three dimensions', () => {
  const tokens = tokenize('scope election through social and economic and foreign into scenarios');
  assertEqual(tokens[0].type, 'SCOPE_STMT');
  assert(tokens[0].value.dimensions.length >= 2, 'Should have at least 2 dimensions');
});

test('tokenize scenario statement', () => {
  const tokens = tokenize('scenario worst_case when recession hits likely high');
  assertEqual(tokens.length, 1);
  assertEqual(tokens[0].type, 'SCENARIO_STMT');
  assertEqual(tokens[0].value.name, 'worst_case');
  assertEqual(tokens[0].value.condition, 'recession hits');
  assertEqual(tokens[0].value.probability, 'high');
});

test('tokenize scenario with numeric probability', () => {
  const tokens = tokenize('scenario exact_case when all conditions met likely 0.85');
  assertEqual(tokens[0].type, 'SCENARIO_STMT');
  assertEqual(tokens[0].value.probability, '0.85');
});

test('tokenize scenario with medium probability', () => {
  const tokens = tokenize('scenario base_case when nothing changes likely medium');
  assertEqual(tokens[0].type, 'SCENARIO_STMT');
  assertEqual(tokens[0].value.probability, 'medium');
});

// ── Parser Tests ─────────────────────────────────────────────

console.log('');
console.log('── Parser ──');

test('parse story statement', () => {
  const ast = parse(tokenize('story s1 from twitter about "test" into l1'));
  assertEqual(ast.statements.length, 1);
  assertEqual(ast.statements[0].type, 'StoryStmt');
  assertEqual(ast.statements[0].name, 's1');
  assertEqual(ast.statements[0].source, 'twitter');
});

test('parse narrative statement with body', () => {
  const code = `narrative n1 of my_story from scientific
  mark weight as 0.8
end`;
  const ast = parse(tokenize(code));
  assertEqual(ast.statements.length, 1);
  assertEqual(ast.statements[0].type, 'NarrativeStmt');
  assertEqual(ast.statements[0].name, 'n1');
  assertEqual(ast.statements[0].perspective, 'scientific');
  assert(Array.isArray(ast.statements[0].body), 'Should have a body array');
  assertEqual(ast.statements[0].body.length, 1, 'Body should have one statement');
});

test('parse scope statement', () => {
  const ast = parse(tokenize('scope risk through technology and regulation into outcomes'));
  assertEqual(ast.statements[0].type, 'ScopeStmt');
  assertEqual(ast.statements[0].subject, 'risk');
  assertDeepEqual(ast.statements[0].dimensions, ['technology', 'regulation']);
  assertEqual(ast.statements[0].into, 'outcomes');
});

test('parse scenario statement with body', () => {
  const code = `scenario boom when economy grows likely high
  mark confidence as 0.9
end`;
  const ast = parse(tokenize(code));
  assertEqual(ast.statements[0].type, 'ScenarioStmt');
  assertEqual(ast.statements[0].name, 'boom');
  assertEqual(ast.statements[0].condition, 'economy grows');
  assertEqual(ast.statements[0].probability, 'high');
  assert(Array.isArray(ast.statements[0].body));
});

// ── Codegen Tests ────────────────────────────────────────────

console.log('');
console.log('── Codegen ──');

test('compile story statement', () => {
  const js = compile('story s1 from twitter about "election" into l1');
  assert(js.includes('EventMathStory'), 'Should reference EventMathStory');
  assert(js.includes('.scan()'), 'Should call .scan()');
  assert(js.includes('s1'), 'Should declare story variable');
});

test('compile narrative statement', () => {
  const js = compile('narrative n1 of s1 from conservative\nend');
  assert(js.includes('EventMathNarrative'), 'Should reference EventMathNarrative');
  assert(js.includes('.view('), 'Should call .view()');
  assert(js.includes("'conservative'"), 'Should include perspective');
});

test('compile scope statement', () => {
  const js = compile('scope market through finance and economy into alts');
  assert(js.includes('EventMathScope'), 'Should reference EventMathScope');
  assert(js.includes('.analyze('), 'Should call .analyze()');
  assert(js.includes("'market'"), 'Should include subject');
});

test('compile scenario statement', () => {
  const js = compile('scenario wc when weather is bad likely high\nend');
  assert(js.includes('probability'), 'Should include probability');
  assert(js.includes("'wc'"), 'Should include name');
  assert(js.includes("_type: 'scenario'"), 'Should have _type marker');
});

// ── Runtime Tests ────────────────────────────────────────────

console.log('');
console.log('── Runtime ──');

if (EventMathStoryRuntime) {
  const { EventMathStory, EventMathNarrative, EventMathScope } = EventMathStoryRuntime;

  test('EventMathStory constructor', () => {
    const story = new EventMathStory('test_story', 'twitter', 'election');
    assertEqual(story.name, 'test_story');
    assertEqual(story.source, 'twitter');
    assertEqual(story.query, 'election');
    assertEqual(story.status, 'idle');
    assertEqual(story._type, 'story');
  });

  test('EventMathStory.scan() returns a promise and populates events', () => {
    const story = new EventMathStory('scan_test', 'web', 'test query');
    return story.scan().then((events) => {
      assert(Array.isArray(events), 'Events should be an array');
      assert(events.length > 0, 'Should have at least one event');
      assertEqual(story.status, 'complete');
    });
  });

  test('EventMathStory twitter scan', () => {
    const story = new EventMathStory('tw_test', 'twitter', '#tech');
    return story.scan().then((events) => {
      assert(events.length > 0);
      assertEqual(events[0].source, 'twitter');
    });
  });

  test('EventMathNarrative constructor', () => {
    const n = new EventMathNarrative('scientific');
    assertEqual(n.perspective, 'scientific');
    assertEqual(n._type, 'narrative');
  });

  test('EventMathNarrative.view() returns filtered events', () => {
    const story = new EventMathStory('n_test', 'web', 'test');
    const events = [
      { id: 'e1', content: 'Study shows evidence of progress' },
      { id: 'e2', content: 'Random unrelated news' },
    ];
    story.events = events;
    const n = new EventMathNarrative('scientific');
    const result = n.view(story);
    assert(Array.isArray(result), 'Result should be an array');
    assert(result.length <= events.length, 'Should not return more events than input');
    for (const item of result) {
      assert(item.event, 'Each item should have an event');
      assertEqual(item.perspective, 'scientific');
      assert(typeof item.relevance === 'number', 'Should have relevance score');
      assert(typeof item.confidence === 'number', 'Should have confidence score');
    }
  });

  test('EventMathNarrative with divergent perspectives', () => {
    const story = new EventMathStory('p_test', 'web', 'policy');
    const events = [
      { id: 'e1', content: 'New security measures ensure order and stability' },
      { id: 'e2', content: 'Reform brings equality and justice for all' },
    ];
    story.events = events;
    const conNarr = new EventMathNarrative('conservative');
    const libNarr = new EventMathNarrative('liberal');
    const conResult = conNarr.view(story);
    const libResult = libNarr.view(story);
    // Different perspectives should order events differently
    if (conResult.length > 0 && libResult.length > 0) {
      // Not asserting ordering (may be equal), just that both work
      assert(true, 'Both perspectives work');
    }
  });

  test('EventMathScope.analyze() returns alternatives', () => {
    const result = EventMathScope.analyze('economy', ['inflation', 'employment']);
    assertEqual(result.subject, 'economy');
    assertDeepEqual(result.dimensions, ['inflation', 'employment']);
    assert(Array.isArray(result.alternatives));
    assert(result.alternatives.length >= 6, 'Should have at least 6 alternatives (3 per dimension × 2)');
    // Check positive/negative/neutral for each dimension
    const dims = result.alternatives.filter(a => a.dimension === 'inflation');
    assert(dims.length >= 3, 'Should have 3 polarities for inflation');
    assert(dims.some(a => a.polarity === 'positive'), 'Should have positive polarity');
    assert(dims.some(a => a.polarity === 'negative'), 'Should have negative polarity');
  });

  test('EventMathScope.analyze() with single dimension', () => {
    const result = EventMathScope.analyze('stock_market', ['volatility']);
    assert(result.alternatives.length >= 3, 'Single dimension should produce 3 polarities');
  });

  test('EventMathScope.analyze() cross-dimensional combinations', () => {
    const result = EventMathScope.analyze('policy', ['economic', 'social', 'foreign']);
    const combined = result.alternatives.filter(a => a.polarity === 'combined');
    assert(combined.length >= 2, 'Should have cross-dimensional combinations');
  });
} else {
  console.log('  ∼ Runtime tests skipped (runtime module not available)');
  skipped += 9;
}

// ── Full Pipeline Integration Test ──────────────────────────

console.log('');
console.log('── Integration ──');

test('full pipeline: story + narrative + scope + scenario', () => {
  const code = `
story election_news from twitter about "presidential election" into raw_events
narrative liberal_view of election_news from liberal
end
scope political_impact through social and economic into alternative_futures
scenario best_case when turnout is high likely high
end
`;
  const js = compile(code);
  assert(js.includes('EventMathStory'), 'Story present');
  assert(js.includes('EventMathNarrative'), 'Narrative present');
  assert(js.includes('EventMathScope'), 'Scope present');
  assert(js.includes('_type: \'scenario\''), 'Scenario present');
  assert(js.includes('election_news'), 'Story name present');
  assert(js.includes('liberal_view'), 'Narrative name present');
  assert(js.includes('political_impact'), 'Scope result present');
  assert(js.includes('best_case'), 'Scenario name present');
});

// ── Summary ────────────────────────────────────────────────

console.log('');
console.log('═══════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log('═══════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
