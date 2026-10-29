import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const storeFile = () => path.join(app.getPath('userData'), 'kassa.json')
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
const KEEP_BACKUPS = 30
const DAY = 864e5

async function readJson(f) {
  try {
    return JSON.parse(await fs.readFile(f, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e // corrupt file: let the UI refuse to save so we never overwrite it
  }
}

async function writeJson(f, data) {
  await fs.mkdir(path.dirname(f), { recursive: true })
  await fs.writeFile(f + '.tmp', JSON.stringify(data))
  await fs.rename(f + '.tmp', f) // atomic replace: a crash mid-write can't leave a half file
}

async function settings() {
  const s = (await readJson(settingsFile())) ?? {}
  // OneDrive syncs it off this PC, so a dead disk loses nothing
  s.backupDir ??= path.join(process.env.OneDrive || app.getPath('documents'), 'Kassa backup')
  return s
}

async function listBackups(backupDir) {
  try {
    return (await fs.readdir(backupDir)).filter((f) => /^kassa-.*\.json$/.test(f)).sort() // timestamped names sort by date
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
}

async function backupInfo() {
  const { backupDir } = await settings()
  const files = await listBackups(backupDir)
  const last = files.at(-1)
  return { dir: backupDir, count: files.length, last: last ? (await fs.stat(path.join(backupDir, last))).mtime.toISOString() : null, dataFile: storeFile() }
}

async function backup(label = '') {
  const data = await fs.readFile(storeFile(), 'utf8').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)))
  if (data === null) return backupInfo() // nothing saved yet
  const { backupDir } = await settings()
  await fs.mkdir(backupDir, { recursive: true })
  const now = new Date(), local = new Date(now - now.getTimezoneOffset() * 6e4) // local time in the file name
  const stamp = local.toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-')
  await fs.writeFile(path.join(backupDir, `kassa-${stamp}${label}.json`), data)
  const files = await listBackups(backupDir)
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) await fs.unlink(path.join(backupDir, f))
  return backupInfo()
}

// Window colours per theme; they match --cover (title bar), --hero-ink and --ground (background) in src/style.css
const OVERLAY = { light: { color: '#1E3B30', symbolColor: '#F1F4EC', height: 56 }, dark: { color: '#0A110E', symbolColor: '#F1F4EC', height: 56 } }
const GROUND = { light: '#E6ECE2', dark: '#0F1714' }
const mode = () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')

ipcMain.handle('getTheme', async () => (await settings()).theme ?? 'system')
ipcMain.handle('setTheme', async (_e, t) => {
  if (!['system', 'light', 'dark'].includes(t)) throw new Error('Okänt tema: ' + t)
  nativeTheme.themeSource = t // also drives prefers-color-scheme in the page, for 'system'
  await writeJson(settingsFile(), { ...(await settings()), theme: t })
})

ipcMain.handle('load', () => readJson(storeFile()))
// Account pages for subscriptions open in the user's own browser; only https links, never files or other schemes
ipcMain.handle('openExternal', (_e, url) => {
  if (new URL(url).protocol !== 'https:') throw new Error('Bara https-länkar kan öppnas')
  return shell.openExternal(url)
})
ipcMain.handle('save', (_e, data) => writeJson(storeFile(), data))
ipcMain.handle('backup', () => backup())
ipcMain.handle('backupInfo', () => backupInfo())
ipcMain.handle('openBackupDir', async () => { const { backupDir } = await settings(); await fs.mkdir(backupDir, { recursive: true }); return shell.openPath(backupDir) })

ipcMain.handle('chooseBackupDir', async (e) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Välj mapp för säkerhetskopior', properties: ['openDirectory', 'createDirectory'] })
  if (r.canceled) return backupInfo()
  await writeJson(settingsFile(), { ...(await settings()), backupDir: r.filePaths[0] })
  return backup()
})

ipcMain.handle('restore', async (e) => {
  const { backupDir } = await settings()
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Välj säkerhetskopia att återställa', defaultPath: backupDir, filters: [{ name: 'Kassa-data', extensions: ['json'] }], properties: ['openFile'] })
  if (r.canceled) return null
  const data = JSON.parse(await fs.readFile(r.filePaths[0], 'utf8'))
  if (!Array.isArray(data?.tx)) throw new Error('Filen är inte en säkerhetskopia från Kassa')
  await backup('_fore-aterstallning') // the current state stays recoverable
  await writeJson(storeFile(), data)
  return data
})

app.setAppUserModelId('se.kassa.app') // taskbar groups and shows the app's own icon

app.whenReady().then(async () => {
  try { nativeTheme.themeSource = (await settings()).theme ?? 'system' } catch (e) { console.error('Settings unreadable:', e) }
  const win = new BrowserWindow({
    width: 1440, height: 960, minWidth: 900, backgroundColor: GROUND[mode()], title: 'Kassa',
    icon: path.join(dir, '../build/icon.png'),
    show: false, // shown on ready-to-show, so there is no white flash
    // The app's header is the title bar; Windows draws only the min/max/close buttons, in the app's colours
    titleBarStyle: 'hidden',
    titleBarOverlay: OVERLAY[mode()],
    webPreferences: { preload: path.join(dir, 'preload.cjs') },
  })
  nativeTheme.on('updated', () => { win.setTitleBarOverlay(OVERLAY[mode()]); win.setBackgroundColor(GROUND[mode()]) })
  win.once('ready-to-show', () => win.show())
  win.setMenuBarVisibility(false)
  if (process.env.KASSA_DEV) win.loadURL('http://localhost:5173')
  else win.loadFile(path.join(dir, '../dist/index.html'))

  // Daily safety net on top of the backup after each import
  try {
    const { last } = await backupInfo()
    if (!last || Date.now() - new Date(last) > DAY) await backup()
  } catch (e) { console.error('Backup failed:', e) }
})

app.on('window-all-closed', () => app.quit())
