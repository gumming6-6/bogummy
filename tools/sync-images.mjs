#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const projectRoot = process.cwd()
const publicDir = path.join(projectRoot, 'public')
const imagesDir = path.join(publicDir, 'images')
const catalogPath = path.join(publicDir, 'catalog.json')

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function slugify(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-')
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ans = await new Promise(res => rl.question(question, res))
  rl.close()
  return ans
}

function loadCatalog() {
  if (!fs.existsSync(catalogPath)) {
    return { v: 1, title: "포카 카탈로그", note: "자동 생성됨", items: [] }
  }
  try {
    const raw = fs.readFileSync(catalogPath, 'utf-8')
    const json = JSON.parse(raw)
    if (!json.v) json.v = 1
    if (!Array.isArray(json.items)) json.items = []
    return json
  } catch (e) {
    console.error('catalog.json 읽기 오류:', e.message)
    return { v: 1, title: "포카 카탈로그", note: "자동 생성됨", items: [] }
  }
}

function saveCatalog(json) {
  fs.writeFileSync(catalogPath, JSON.stringify(json, null, 2), 'utf-8')
}

function ensureDirs() {
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })
}

function copyFileIfNeeded(src, dest) {
  if (fs.existsSync(dest)) {
    const s = fs.statSync(src)
    const d = fs.statSync(dest)
    if (s.size === d.size && s.mtimeMs <= d.mtimeMs) {
      return false
    }
  }
  fs.copyFileSync(src, dest)
  return true
}

function makeIdFromName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '')
  const stamp = Date.now().toString(36).slice(-4)
  return `${slugify(base)}-${stamp}`
}

async function main() {
  ensureDirs()

  let srcDir = null
  const args = process.argv.slice(2)
  if (args[0] === '--from') {
    srcDir = args[1]
  }
  if (!srcDir) {
    srcDir = await ask('복사할 이미지 폴더 경로를 입력하세요: ')
  }
  if (!srcDir || !fs.existsSync(srcDir)) {
    console.error('경로가 없어요. 종료합니다.')
    process.exit(1)
  }

  const files = fs.readdirSync(srcDir)
    .filter(f => exts.has(path.extname(f).toLowerCase()))

  if (!files.length) {
    console.log('가져올 이미지가 없습니다. (jpg, jpeg, png, webp)')
    process.exit(0)
  }

  const defaultDate = await ask('모든 항목에 기본으로 넣을 구매 날짜(YYYY-MM-DD, 엔터=비움): ')
  const defaultEvent = await ask('기본 이벤트(엔터=비움): ')
  const defaultVendor = await ask('기본 구매처(엔터=비움): ')

  const catalog = loadCatalog()
  const existingByUrl = new Map(catalog.items.map(it => [it.imageUrl, it]))
  let copied = 0, added = 0, updated = 0

  for (const f of files) {
    const srcPath = path.join(srcDir, f)
    const safeName = slugify(f)
    const destPath = path.join(imagesDir, safeName)
    const changed = copyFileIfNeeded(srcPath, destPath)
    if (changed) copied++

    const relUrl = `images/${safeName}`
    const found = existingByUrl.get(relUrl)
    if (!found) {
      catalog.items.push({
        id: makeIdFromName(safeName),
        title: path.basename(safeName, path.extname(safeName)),
        purchaseDate: defaultDate || "",
        event: defaultEvent || "",
        vendor: defaultVendor || "",
        year: (defaultDate || "").slice(0,4) || "",
        notes: "",
        imageUrl: relUrl,
        have: false
      })
      added++
    } else {
      updated++
    }
  }

  saveCatalog(catalog)
  console.log(`완료: 복사 ${copied}개, 신규 항목 ${added}개, 기존 업데이트 ${updated}개`)
  console.log(`→ catalog.json 항목 수: ${catalog.items.length}`)
  console.log('배포 링크 예시: https://<USER>.github.io/<REPO>/?src=' +
    encodeURIComponent('https://<USER>.github.io/<REPO>/catalog.json'))
}

main().catch(e => { console.error(e); process.exit(1) })
