import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(html: string) {
  const win = new BrowserWindow({ width: 600, height: 500, show: false })
  win.on('ready-to-show', () => win.show())
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${html}`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${html}`))
  }
  return win
}

app.whenReady().then(() => {
  createWindow('quick.html')
  createWindow('settings.html')
})

app.on('window-all-closed', () => app.quit())
