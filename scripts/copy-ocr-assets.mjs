// Copies the OCR engine and French model from node_modules so the app serves them itself (CSP blocks external CDNs).
import { cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const target = join(root, 'public', 'ocr')
mkdirSync(join(target, 'lang'), { recursive: true })

cpSync(join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), join(target, 'worker.min.js'))
for (const file of ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) {
  cpSync(join(root, 'node_modules', 'tesseract.js-core', file), join(target, file))
}
cpSync(join(root, 'node_modules', '@tesseract.js-data', 'fra', '4.0.0_best_int', 'fra.traineddata.gz'), join(target, 'lang', 'fra.traineddata.gz'))
