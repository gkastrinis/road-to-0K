const {app, BrowserWindow, shell} = require('electron')
const Store = require('electron-store')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
    let store = new Store({ defaults: { windowBounds: { width: 800, height: 600, x: 0, y: 0 } } })
    let { width, height, x, y } = store.get('windowBounds')

    win = new BrowserWindow({
        title: 'Road to 0K',
        icon: './dota2-inv.png',
        width, height,
        x, y,
        minWidth: 1024, minHeight: 800,
        show: false,
        frame: false
    })
    win.loadFile('index.html')
    win.setMenu(null)
    win.show()
    //win.webContents.openDevTools()

    // The BrowserWindow class extends the node.js core EventEmitter class, so we use that API
    // to listen to events on the BrowserWindow. The resize event is emitted when the window size changes.
    win.on('resize', () => { store.set('windowBounds', win.getBounds()) })
    win.on('move', () => { store.set('windowBounds', win.getBounds()) })
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win.on('closed', () => { win = null })

    // Open URLs externally
	win.webContents.on('new-window', (event, url) => {
		event.preventDefault()
		shell.openExternal(url)
	})
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)