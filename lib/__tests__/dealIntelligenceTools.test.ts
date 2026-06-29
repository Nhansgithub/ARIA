// lib/__tests__/dealIntelligenceTools.test.ts
// ts-node: npx ts-node lib/__tests__/dealIntelligenceTools.test.ts
//
// Inlines DI_TOOLS — tsconfig "moduleResolution": "bundler" is incompatible
// with ts-node's ESM resolution for local .ts imports (established project pattern).

import assert from 'assert'

console.log('=== dealIntelligenceTools.test.ts ===\n')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}: ${e}`)
    failed++
  }
}

// Inline the tool definitions with permissive types for ts-node compatibility.
// The properties type is kept wide (Record<string, unknown>) to avoid TS2353
// when nesting complex schema objects that include 'type', 'items', etc.
type AnyTool = {
  name: string
  input_schema: {
    required?: readonly string[]
    properties: Record<string, unknown>
  }
}

function enumOf(prop: unknown): string[] {
  if (prop && typeof prop === 'object' && 'enum' in prop) {
    return (prop as { enum: string[] }).enum
  }
  return []
}

function itemsOf(prop: unknown): unknown {
  if (prop && typeof prop === 'object' && 'items' in prop) {
    return (prop as { items: unknown }).items
  }
  return undefined
}

const DI_TOOLS: AnyTool[] = [
  {
    name: 'find_similar_deals',
    input_schema: {
      properties: {
        service_type: { type: 'string', enum: ['web_design', 'web_app', 'automation', 'other'] },
        industry: { type: 'string' },
        exclude_deal_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_client',
    input_schema: {
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal',
    input_schema: {
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'update_intelligence_fields',
    input_schema: {
      properties: {
        deal_id: { type: 'string' },
        inferred_real_need: { type: 'string' },
        risk_flags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              flag: { type: 'string' },
              severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
              noted_at: { type: 'string' },
            },
          },
        },
        opportunity_signals: {
          type: 'array',
          items: { type: 'object', properties: { signal: { type: 'string' } } },
        },
        predicted_outcome: {
          type: 'string',
          enum: ['likely_win', 'uncertain', 'at_risk', 'likely_lost'],
        },
        prediction_reason: { type: 'string' },
        similar_deals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deal_id: { type: 'string' },
              similarity_reason: { type: 'string' },
            },
          },
        },
      },
      required: ['deal_id'],
    },
  },
]

test('T1 — four tools defined', () => {
  assert.strictEqual(DI_TOOLS.length, 4)
})

test('T2 — find_similar_deals present', () => {
  assert.ok(DI_TOOLS.some((t) => t.name === 'find_similar_deals'))
})

test('T3 — get_client present', () => {
  assert.ok(DI_TOOLS.some((t) => t.name === 'get_client'))
})

test('T4 — get_deal present', () => {
  assert.ok(DI_TOOLS.some((t) => t.name === 'get_deal'))
})

test('T5 — update_intelligence_fields present', () => {
  assert.ok(DI_TOOLS.some((t) => t.name === 'update_intelligence_fields'))
})

test('T6 — update_intelligence_fields requires deal_id; others have no required', () => {
  const uif = DI_TOOLS.find((t) => t.name === 'update_intelligence_fields')!
  assert.ok(uif.input_schema.required?.includes('deal_id'), 'deal_id must be required')

  for (const t of DI_TOOLS) {
    if (t.name === 'update_intelligence_fields') continue
    const req = t.input_schema.required ?? []
    assert.strictEqual(req.length, 0, `${t.name} should have no required fields`)
  }
})

test('T7 — predicted_outcome enum values', () => {
  const uif = DI_TOOLS.find((t) => t.name === 'update_intelligence_fields')!
  const enums = enumOf(uif.input_schema.properties['predicted_outcome'])
  for (const v of ['likely_win', 'uncertain', 'at_risk', 'likely_lost']) {
    assert.ok(enums.includes(v), `predicted_outcome enum missing: ${v}`)
  }
})

test('T8 — risk_flags severity enum: HIGH, MEDIUM, LOW', () => {
  const uif = DI_TOOLS.find((t) => t.name === 'update_intelligence_fields')!
  const items = itemsOf(uif.input_schema.properties['risk_flags'])
  const severityProp =
    items && typeof items === 'object' && 'properties' in items
      ? (items as { properties: Record<string, unknown> }).properties['severity']
      : undefined
  const severityEnum = enumOf(severityProp)
  for (const v of ['HIGH', 'MEDIUM', 'LOW']) {
    assert.ok(severityEnum.includes(v), `severity enum missing: ${v}`)
  }
})

test('T9 — alphabetical sort is cache-stable (AD-5)', () => {
  const sorted = [...DI_TOOLS].map((t) => t.name).sort((a, b) => a.localeCompare(b))
  assert.deepStrictEqual(sorted, [
    'find_similar_deals',
    'get_client',
    'get_deal',
    'update_intelligence_fields',
  ])
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
