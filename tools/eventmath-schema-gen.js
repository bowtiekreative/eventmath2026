#!/usr/bin/env node
/**
 * EventMath Schema Generator
 *
 * Uses the Claude API to generate EventMath schemas for any domain,
 * then compiles and exports them as structured API schemas.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "human body proteins"
 *   ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "racism systemic framework"
 *   ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "supply chain resilience"
 *
 * Options:
 *   --domain    <string>  Domain to model (required)
 *   --key       <string>  Anthropic API key (or set ANTHROPIC_API_KEY env var)
 *   --out       <dir>     Output directory (default: ./generated)
 *   --model     <string>  Claude model (default: claude-sonnet-4-6)
 *   --no-api    Run in offline mode (skip API calls, compile example input)
 *   --help      Show this help
 *
 * Output files (in ./generated/<domain-slug>/):
 *   schema.em           — EventMath source for the domain
 *   schema.js           — Compiled JavaScript
 *   api-schema.json     — OpenAPI-compatible JSON schema
 *   insights.txt        — Human-readable insights from the model
 */

'use strict';

const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const { EventMathTokenizer } = require('../src/tokenizer.js');
const { EventMathParser }    = require('../src/parser.js');
const { EventMathCodeGen }   = require('../src/codegen.js');

// ── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { domain: '', key: '', out: './generated', model: 'claude-sonnet-4-6', noApi: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help') { printHelp(); process.exit(0); }
    if (argv[i] === '--no-api') { args.noApi = true; continue; }
    if (argv[i] === '--domain' && argv[i+1]) { args.domain = argv[++i]; continue; }
    if (argv[i] === '--key'    && argv[i+1]) { args.key    = argv[++i]; continue; }
    if (argv[i] === '--out'    && argv[i+1]) { args.out    = argv[++i]; continue; }
    if (argv[i] === '--model'  && argv[i+1]) { args.model  = argv[++i]; continue; }
  }
  if (!args.key) args.key = process.env.ANTHROPIC_API_KEY || '';
  return args;
}

function printHelp() {
  console.log(`
EventMath Schema Generator — maps any domain into a causal model and API schema.

Usage:
  ANTHROPIC_API_KEY=sk-ant-... node tools/eventmath-schema-gen.js --domain "domain name"

Options:
  --domain <string>   Domain to model (e.g. "human body proteins", "racism systemic framework")
  --key    <string>   Anthropic API key (or set ANTHROPIC_API_KEY env var)
  --out    <dir>      Output directory (default: ./generated)
  --model  <string>   Claude model ID (default: claude-sonnet-4-6)
  --no-api            Offline mode — skip API, use hardcoded example
  --help              Show this help
`.trim());
}

// ── EventMath syntax reference (injected into system prompt) ──────────────────

const EVENTMATH_SYNTAX = `
EventMath is a programming language for modeling causal systems. Key syntax:

ASSUMPTIONS (named constants):
  assume market rate is 500
  assume minimum reach is 10000

CHAINS (causal graphs with optional numeric values):
  chain protein folding chain
    amino acids leads to polypeptide at value 85
    polypeptide leads to secondary structure at value 70
    secondary structure leads to tertiary structure at value 60
    tertiary structure leads to functional protein at value 90
  end

DESIRES (goals to evaluate):
  desire proper function
  category biological goal
  matter
    scenario is protein synthesis
    subjective is The protein achieves its biological function
    outcome is functional protein at efficiency above threshold
    direction is more than
    state is desired
    satisfied when is functional protein more than minimum threshold
  end
  end

FRACTAL AXES (structural tiers — surface D±13 / system D±26 / root D±39):
  spin systemic suppression into suppression torus at dimension -39
  spin systemic signal into signal torus at dimension 39
  fractal suppression torus and signal torus into domain axis

EVALUATION (3-tier dimensional scoring):
  evaluate proper function against protein folding chain across fractal domain axis into domain report
  show domain report

DIAGNOSIS (backward tracing — why a goal is not met):
  why proper function is not satisfied in protein folding chain into diagnosis
  show diagnosis

PREDICTION (N-dimensional cartesian product, fractal-routed):
  predict outcomes
    across tissue types
    and protein families
    and environmental conditions
    through domain axis
    into predictions

Rules:
- One statement per line. Blocks end with "end".
- Multi-word names are fine: "amino acids", "functional protein", "domain axis".
- Values in chains are numeric (0–10000). Higher = more active/productive.
- Fractal axes use D±13 (surface), D±26 (system), D±39 (root).
- "at value 0" means the link is blocked / inactive.
`.trim();

// ── Claude API call ───────────────────────────────────────────────────────────

function callClaude(apiKey, model, messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
          resolve(text);
        } catch (e) {
          reject(new Error('API parse error: ' + e.message + '\nRaw: ' + data.slice(0, 500)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Step 1: generate the .em schema for the domain ───────────────────────────

async function generateSchema(apiKey, model, domain) {
  const systemPrompt = `You are an EventMath schema designer. EventMath models causal systems as chains of events, desires, assumptions, and fractal axes.

${EVENTMATH_SYNTAX}

When given a domain, produce a complete, valid EventMath schema that:
1. Defines 3–5 assumptions (key numeric constants for the domain)
2. Defines 1–2 causal chains (each with 5–8 links, all with "at value N" where N reflects real-world strength 0–100)
3. Defines 2–3 desires (goals that can be evaluated against the chains)
4. Defines a fractal axis (spin two toruses, create the axis)
5. Evaluates desires across the chain and fractal axis (dimensional report)
6. Diagnoses why a desire might not be satisfied (why statement)
7. Adds explanatory comments using the "note" keyword

Output ONLY the EventMath source code, no explanation. Start with: note EventMath schema for ${domain}`;

  const userPrompt = `Generate a complete EventMath schema for the domain: "${domain}"

The schema should model the real causal structure of this domain — what leads to what, what are the key values, what are the goals, where do paths break.`;

  console.log('  Generating EventMath schema via Claude API...');
  return callClaude(apiKey, model, [{ role: 'user', content: userPrompt }], systemPrompt);
}

// ── Step 2: compile the .em schema ───────────────────────────────────────────

function compileSchema(emSource) {
  try {
    const tokens = new EventMathTokenizer().tokenize(emSource);
    const ast    = new EventMathParser(tokens).parse();
    const js     = new EventMathCodeGen().generate(ast);
    return { js, errors: [] };
  } catch (e) {
    return { js: '', errors: [e.message] };
  }
}

// ── Step 3: run compiled JS and capture output ────────────────────────────────

function runCompiledSchema(js) {
  let output = '';
  try {
    const fn = new Function('require', 'console', 'module', js);
    fn(
      require,
      { log: (s) => { output += s + '\n'; } },
      { exports: {} }
    );
  } catch (e) {
    output += '\n[Runtime error: ' + e.message + ']\n';
  }
  return output;
}

// ── Step 4: generate OpenAPI schema from insights ────────────────────────────

async function generateApiSchema(apiKey, model, domain, emSource, insights) {
  const systemPrompt = `You are an API schema designer. Given an EventMath causal model and its runtime output, generate an OpenAPI 3.0 JSON schema that exposes the model as a REST API.

The API should have endpoints for:
- GET /schema — return the full domain model
- GET /evaluate — evaluate desires against chains (with query params for dimension values)
- POST /diagnose — find why a goal is not met given a scenario
- GET /predict — predict outcomes across condition dimensions

Output ONLY valid JSON. No markdown, no explanation.`;

  const userPrompt = `Domain: "${domain}"

EventMath Schema:
${emSource.slice(0, 2000)}

Runtime Insights:
${insights.slice(0, 1000)}

Generate a complete OpenAPI 3.0 JSON schema for this domain model.`;

  console.log('  Generating OpenAPI schema via Claude API...');
  const raw = await callClaude(apiKey, model, [{ role: 'user', content: userPrompt }], systemPrompt);

  // Extract JSON if wrapped in markdown
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  const jsonText  = jsonMatch ? jsonMatch[1].trim() : raw.trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    return { raw: jsonText, parseError: 'Response was not valid JSON — see raw field' };
  }
}

// ── Offline example (--no-api mode) ──────────────────────────────────────────

function getOfflineExample(domain) {
  return `note EventMath schema for ${domain} (offline example)
note Generated without API — replace with real domain values

assume baseline threshold is 50
assume optimal threshold is 80
assume critical mass is 1000

chain ${domain} forward chain
  initial state leads to early activation at value 30
  early activation leads to mid process at value 55
  mid process leads to high activity at value 70
  high activity leads to peak output at value 85
  peak output leads to desired outcome at value 90
end

chain ${domain} blocked chain
  initial state leads to early activation at value 30
  early activation leads to stall point at value 10
  stall point leads to blocked output at value 0
  blocked output leads to desired outcome at value 0
end

desire reach optimal
category domain goal
matter
  scenario is ${domain} optimization
  subjective is The process reaches optimal performance
  outcome is desired outcome at optimal threshold
  direction is more than
  state is desired
  satisfied when is desired outcome more than optimal threshold
end
end

spin systemic noise into noise torus at dimension -39
spin domain signal into signal torus at dimension 39
fractal signal torus and noise torus into domain axis

evaluate reach optimal against ${domain} forward chain across fractal domain axis into forward report
show forward report

why reach optimal is not satisfied in ${domain} blocked chain into diagnosis
show diagnosis
`;
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (!args.domain) {
    console.error('Error: --domain is required. Run with --help for usage.');
    process.exit(1);
  }

  if (!args.noApi && !args.key) {
    console.error('Error: ANTHROPIC_API_KEY is not set. Pass --key or set the env var, or use --no-api for offline mode.');
    process.exit(1);
  }

  const domainSlug = slug(args.domain);
  const outDir     = path.resolve(args.out, domainSlug);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\nEventMath Schema Generator`);
  console.log(`  Domain : ${args.domain}`);
  console.log(`  Model  : ${args.noApi ? 'offline' : args.model}`);
  console.log(`  Output : ${outDir}`);
  console.log('');

  // Step 1: generate .em schema
  let emSource;
  if (args.noApi) {
    console.log('  [offline mode] Using example schema...');
    emSource = getOfflineExample(args.domain);
  } else {
    emSource = await generateSchema(args.key, args.model, args.domain);
  }
  fs.writeFileSync(path.join(outDir, 'schema.em'), emSource, 'utf8');
  console.log('  ✓ schema.em written');

  // Step 2: compile
  console.log('  Compiling EventMath schema...');
  const { js, errors } = compileSchema(emSource);
  if (errors.length > 0) {
    console.warn('  ⚠ Compile warnings:', errors.join('; '));
  }
  if (js) {
    fs.writeFileSync(path.join(outDir, 'schema.js'), js, 'utf8');
    console.log('  ✓ schema.js written');
  }

  // Step 3: run and capture insights
  let insights = '';
  if (js) {
    console.log('  Running compiled schema...');
    insights = runCompiledSchema(js);
    fs.writeFileSync(path.join(outDir, 'insights.txt'), insights, 'utf8');
    console.log('  ✓ insights.txt written');
  }

  // Step 4: generate OpenAPI schema
  let apiSchema;
  if (args.noApi) {
    apiSchema = buildOfflineApiSchema(args.domain, domainSlug);
  } else {
    apiSchema = await generateApiSchema(args.key, args.model, args.domain, emSource, insights);
  }
  fs.writeFileSync(path.join(outDir, 'api-schema.json'), JSON.stringify(apiSchema, null, 2), 'utf8');
  console.log('  ✓ api-schema.json written');

  // Summary
  console.log('\n  ── Generated files ──');
  console.log(`  ${path.join(outDir, 'schema.em')}       — EventMath domain model`);
  console.log(`  ${path.join(outDir, 'schema.js')}       — Compiled JavaScript`);
  console.log(`  ${path.join(outDir, 'insights.txt')}    — Runtime output`);
  console.log(`  ${path.join(outDir, 'api-schema.json')} — OpenAPI 3.0 schema`);

  if (insights) {
    console.log('\n  ── Insights preview ──');
    console.log(insights.split('\n').slice(0, 15).map(l => '  ' + l).join('\n'));
  }

  console.log('\n  Done.\n');
}

function buildOfflineApiSchema(domain, domainSlug) {
  return {
    openapi: '3.0.0',
    info: {
      title: `${domain} EventMath API`,
      description: `Causal model API for the domain: ${domain}. Generated by EventMath Schema Generator.`,
      version: '1.0.0',
    },
    paths: {
      '/schema': {
        get: {
          summary: 'Get the full domain model',
          description: 'Returns the EventMath causal model for this domain as structured JSON.',
          responses: {
            '200': { description: 'Domain model', content: { 'application/json': { schema: { type: 'object' } } } }
          }
        }
      },
      '/evaluate': {
        get: {
          summary: 'Evaluate desires against the domain chain',
          description: 'Scores how well the causal chain satisfies defined desires across three tiers (surface D±13, system D±26, root D±39).',
          parameters: [
            { name: 'chain', in: 'query', schema: { type: 'string' }, description: 'Chain name to evaluate against' },
            { name: 'fractal', in: 'query', schema: { type: 'string' }, description: 'Fractal axis for dimensional scoring' },
          ],
          responses: {
            '200': {
              description: 'Dimensional evaluation report',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tier1Score: { type: 'number', description: 'Surface score (0–100)' },
                      tier2Score: { type: 'number', description: 'System score (0–100)' },
                      tier3Score: { type: 'number', description: 'Root score (0–100)' },
                      gradient:   { type: 'string', description: 'ALIGNED | BLOCKED | SHARP DECLINE | ROOT STRONGER THAN SURFACE | SURFACE VIABLE | ROOT MISALIGNED' },
                      gaps:       { type: 'array',  items: { type: 'object' } },
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/diagnose': {
        post: {
          summary: 'Find why a desire is not satisfied',
          description: 'Backward satisfaction trace: given a desire that is not met, walks the chain backward to find the blocking node and minimum intervention.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    desire: { type: 'string', description: 'Name of the desire to diagnose' },
                    chain:  { type: 'string', description: 'Name of the chain to diagnose against' },
                  },
                  required: ['desire', 'chain']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Diagnosis report',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      isSatisfied:       { type: 'boolean' },
                      blockingLink:      { type: 'object',  description: 'The link where value collapses to 0' },
                      interventionPoint: { type: 'string',  description: 'The specific flip that would unblock the path' },
                      lever:             { type: 'string',  description: 'One-line recommendation' },
                      tierAnalysis:      { type: 'array',   items: { type: 'object' } },
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/predict': {
        get: {
          summary: 'Predict outcomes across condition dimensions',
          description: 'N-dimensional cartesian product, optionally routed through the fractal axis for tier-aware scoring.',
          parameters: [
            { name: 'dimensions', in: 'query', schema: { type: 'string' }, description: 'Comma-separated list of condition dimension names' },
            { name: 'through',    in: 'query', schema: { type: 'string' }, description: 'Fractal axis name for tier routing (optional)' },
          ],
          responses: {
            '200': {
              description: 'Prediction results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      combinations: { type: 'number', description: 'Total number of predictions' },
                      predictions:  { type: 'array',  items: { type: 'object' } },
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        DomainModel: {
          type: 'object',
          description: `EventMath causal model for: ${domain}`,
          properties: {
            chains:      { type: 'array', items: { type: 'object' } },
            desires:     { type: 'array', items: { type: 'object' } },
            assumptions: { type: 'array', items: { type: 'object' } },
            fractalAxis: { type: 'object' },
          }
        }
      }
    }
  };
}

main().catch(e => {
  console.error('\nError:', e.message);
  process.exit(1);
});
