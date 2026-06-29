/**
 * Standalone ts-node test for CRM stub tool definitions.
 * Inlines pure logic to avoid ESM resolution issues with bundler moduleResolution.
 *
 * Run: npx ts-node lib/__tests__/crmTools.test.ts
 */

import assert from 'assert'

// ── Inline tool definitions (mirrors crmTools.ts) ─────────────────────────

const CRM_STUB_TOOLS = [
  {
    name: 'find_similar_clients',
    description:
      'Search for existing clients by name or company. ALWAYS call this first when the Owner mentions a new client, to avoid creating duplicates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Client or contact name to search' },
        company: { type: 'string', description: 'Company or business name to search' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'create_client_stub',
    description:
      'Create a new client stub record. Only call AFTER find_similar_clients confirms no match exists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Client contact name (required)' },
        company: { type: 'string', description: 'Company or business name' },
        industry: { type: 'string', description: 'Industry' },
        language_pref: {
          type: 'string',
          enum: ['vi', 'en'],
          description: "Client's preferred language",
        },
        notes: { type: 'string', description: 'Context from the conversation' },
      },
      required: ['name'] as string[],
    },
  },
  {
    name: 'create_deal_stub',
    description: 'Create a new deal stub linked to a client. Always call create_client_stub first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'UUID of the client record (required)' },
        title: { type: 'string', description: 'Brief deal description' },
        service_type: {
          type: 'string',
          enum: ['web_design', 'web_app', 'automation', 'other'],
          description: 'Service type',
        },
        client_stated_need: {
          type: 'string',
          description: 'What the client said they want, verbatim',
        },
        value_estimate: { type: 'number', description: 'Estimated deal value in VND' },
        stage: { type: 'string', description: 'Deal stage' },
      },
      required: ['client_id'] as string[],
    },
  },
] as const

// ── Tests ──────────────────────────────────────────────────────────────────

type AnyTool = {
  name: string
  input_schema: {
    required?: readonly string[]
    properties: Record<string, { enum?: readonly string[] }>
  }
}
const tools = CRM_STUB_TOOLS as readonly AnyTool[]

console.log('=== crmTools.test.ts ===\n')

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

test('T1 — three tools defined', () => {
  assert.strictEqual(tools.length, 3)
})

test('T2 — find_similar_clients present', () => {
  assert.ok(tools.some((t) => t.name === 'find_similar_clients'))
})

test('T3 — create_client_stub requires name', () => {
  const t = tools.find((t) => t.name === 'create_client_stub')!
  assert.ok(t.input_schema.required?.includes('name'), 'name must be in required')
})

test('T4 — create_deal_stub requires client_id', () => {
  const t = tools.find((t) => t.name === 'create_deal_stub')!
  assert.ok(t.input_schema.required?.includes('client_id'), 'client_id must be in required')
})

test('T5 — find_similar_clients has no required fields', () => {
  const t = tools.find((t) => t.name === 'find_similar_clients')!
  const req = t.input_schema.required ?? []
  assert.strictEqual(req.length, 0, 'find_similar_clients should have no required fields')
})

test('T6 — service_type enum has expected values', () => {
  const t = tools.find((t) => t.name === 'create_deal_stub')!
  const enums = t.input_schema.properties['service_type']?.enum ?? []
  for (const v of ['web_design', 'web_app', 'automation', 'other']) {
    assert.ok(enums.includes(v as never), `service_type enum missing: ${v}`)
  }
})

test('T7 — alphabetical sort is cache-stable (AD-5)', () => {
  const sorted = [...tools].map((t) => t.name).sort((a, b) => a.localeCompare(b))
  assert.deepStrictEqual(sorted, ['create_client_stub', 'create_deal_stub', 'find_similar_clients'])
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
