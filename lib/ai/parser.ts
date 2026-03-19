import { SECTION_HEADERS, type SectionHeader } from './prompts'

export interface CodeFile {
  filename: string
  language: string
  code: string
}

export interface ParsedSection {
  title: SectionHeader
  content: string
  codeFiles: CodeFile[]
}

export interface ParsedBuild {
  productName: string
  productType: string
  sections: Partial<Record<SectionHeader, ParsedSection>>
  rawOutput: string
}

const SECTION_REGEX = /## \d+\.\s+([\w\s/]+)\n([\s\S]*?)(?=## \d+\.|$)/g

const CODE_BLOCK_REGEX = /```(\w+)(?:\s+filename="([^"]+)")?\n([\s\S]*?)```/g

const PRODUCT_NAME_REGEX = /\*\*(?:Product Name|Name):\*\*\s*([^\n]+)/i

const PRODUCT_TYPE_REGEX = /\*\*(?:Product Type|Category|Type):\*\*\s*([^\n]+)/i

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    css: 'css', html: 'html', json: 'json', sql: 'sql',
    md: 'markdown', sh: 'bash', yaml: 'yaml', yml: 'yaml',
    env: 'bash', toml: 'toml',
  }
  return map[ext ?? ''] ?? 'text'
}

export function parseBuildOutput(rawOutput: string): ParsedBuild {
  const sections: Partial<Record<SectionHeader, ParsedSection>> = {}
  let productName = 'Untitled Product'
  let productType = 'app'

  // Extract product name from interpretation section
  const nameMatch = rawOutput.match(PRODUCT_NAME_REGEX)
  if (nameMatch) productName = nameMatch[1].trim()

  const typeMatch = rawOutput.match(PRODUCT_TYPE_REGEX)
  if (typeMatch) {
    const raw = typeMatch[1].toLowerCase()
    if (raw.includes('saas')) productType = 'saas'
    else if (raw.includes('landing')) productType = 'landing'
    else if (raw.includes('dashboard')) productType = 'dashboard'
    else if (raw.includes('marketplace')) productType = 'marketplace'
    else if (raw.includes('tool')) productType = 'tool'
    else if (raw.includes('website')) productType = 'website'
    else productType = 'app'
  }

  let match: RegExpExecArray | null
  SECTION_REGEX.lastIndex = 0

  while ((match = SECTION_REGEX.exec(rawOutput)) !== null) {
    const titleRaw = match[1].trim().toUpperCase() as SectionHeader
    const header = SECTION_HEADERS.find(h => titleRaw.includes(h.split(' ')[0]))
    if (!header) continue

    const content = match[2].trim()
    const codeFiles: CodeFile[] = []

    CODE_BLOCK_REGEX.lastIndex = 0
    let codeMatch: RegExpExecArray | null
    while ((codeMatch = CODE_BLOCK_REGEX.exec(content)) !== null) {
      const lang = codeMatch[1]
      const filename = codeMatch[2] ?? `file.${lang}`
      const code = codeMatch[3]
      codeFiles.push({
        filename,
        language: detectLanguage(filename) || lang,
        code: code.trim(),
      })
    }

    sections[header] = { title: header, content, codeFiles }
  }

  return { productName, productType, sections, rawOutput }
}

export function extractProductName(text: string): string {
  const match = text.match(PRODUCT_NAME_REGEX)
  return match ? match[1].trim() : ''
}
