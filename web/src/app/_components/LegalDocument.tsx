import fs from 'node:fs'
import path from 'node:path'
import { Fragment } from 'react'
import styles from './public-document.module.css'

type LegalDocumentProps = {
  fileName: string
}

function readLegalDocument(fileName: string) {
  const filePath = path.join(process.cwd(), 'src', 'content', 'legal', fileName)
  return fs.readFileSync(filePath, 'utf8')
}

function renderBlocks(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())

  const blocks: Array<{ type: 'heading' | 'paragraph'; text: string }> = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }

  lines.slice(1).forEach((line) => {
    if (!line) {
      flushParagraph()
      return
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph()
      blocks.push({ type: 'heading', text: line })
      return
    }

    paragraph.push(line)
  })

  flushParagraph()

  return blocks.map((block, index) => {
    if (block.type === 'heading') {
      return <h2 key={`${block.type}-${index}`}>{block.text}</h2>
    }

    return (
      <p key={`${block.type}-${index}`}>
        {block.text.split('info@auditavto.ru').map((part, partIndex, parts) => (
          <Fragment key={partIndex}>
            {part}
            {partIndex < parts.length - 1 ? (
              <a href="mailto:info@auditavto.ru">info@auditavto.ru</a>
            ) : null}
          </Fragment>
        ))}
      </p>
    )
  })
}

export function LegalDocument({ fileName }: LegalDocumentProps) {
  return <div className={styles.legalText}>{renderBlocks(readLegalDocument(fileName))}</div>
}
