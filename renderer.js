const {remote} = require('electron')
const {dialog} = require('electron').remote
const Highcharts = require('highcharts-more-node')
const fs = require('fs')
const Store = require('electron-store')
const WinBar = require('./winbar.js')
const {Menu, MenuItem, MenuSeparator} = require('./menu.js')

const win = remote.getCurrentWindow()
const winBar = new WinBar(win, 'winBar', 'Road to 0K')

const editor = ace.edit('editor')
editor.setTheme('ace/theme/monokai')
editor.session.setMode('ace/mode/json')
editor.setFontSize(14)

let state = {}
loadFile()
if (state.dataFile) {
	$('#empty').hide()
	calculateMMR()
	redraw()
}
initEditor()
initRightClick()


function redraw() {
	let { width, height } = win.getBounds()
	win.setSize(width+1, height+1)
	setTimeout(() => win.setSize(width, height), 1000)
}

function openEditor() {
	winBar.tempTitle(" - " + new Date().toLocaleDateString())
	$('#charts').hide()
	$('#editMMR').show()
	editor.setValue(state.rawData.toString('utf8'), -1)
	let { height } = win.getBounds()
	$('#editor').height(height-100)

	redraw()
}

function closeEditor() {
	winBar.restoreTitle()
	$('#editMMR').hide()
	$('#charts').show()

	redraw()
}

function saveAndCloseEditor() {
	let rawDataStr = editor.getValue()
	fs.writeFile(state.dataFile, rawDataStr, (e, data) => console.log(e))
	state.rawData = Buffer.from(rawDataStr, 'utf8')
	calculateMMR()
	closeEditor()
}

function loadFile() {
	let file = new Store().get('dataFile')
	if (!file) return

	// No file previously
	if (!state.dataFile) $('#empty').hide()

	try {
		state.rawData = fs.readFileSync(file)
		state.dataFile = file
		new Store().set('dataFile', state.dataFile)	
	} catch (err) {
		console.log(err)
		state.dataFile = undefined
		return
	}
	state.data = JSON.parse(state.rawData)
	state.iterations = state.data.mmr.map(it => it.iteration)
	state.currentIteration = state.iterations[0]
}

function initEditor() {
	$('#editMMR').hide()

	$(document).keydown(event => {
		// Ctrl + S
        if ($('#editMMR').is(':visible') && (event.ctrlKey || event.metaKey) && event.which == 83) {
			event.preventDefault()
			saveAndCloseEditor()
            return false
		}
		// Esc
		else if (event.which == 27) {
			event.preventDefault()
			closeEditor()
            return false
		}
    })
	$('#save').click(saveAndCloseEditor)
	$('#cancel').click(closeEditor)
}

function initRightClick() {
	const menu = new Menu('menu', 'c-b-dark-gray-2')
	menu.addItem(new MenuItem('Edit MMR', openEditor, !!state.dataFile))
	menu.addItem(new MenuItem('Reload', () => {
		loadFile()
		calculateMMR()
	}, !!state.dataFile))
	menu.addItem(new MenuItem('MMR file', () => {
		dialog.showOpenDialog(files => {
			if (!files) return
			state.dataFile = files[0]
			loadFile()
			calculateMMR()
			initRightClick()
		})
	}, true))

	if (state.iterations) {
		menu.addItem(new MenuSeparator())
		state.iterations.forEach(it => {
			menu.addItem(new MenuItem(it, () => {
				state.currentIteration = it
				calculateMMR()
			}, true))
		})
	}

	menu.addItem(new MenuSeparator())
	menu.addItem(new MenuItem('DevTools', () => win.webContents.openDevTools(), true))
}

function calculateMMR() {
	if (!state.dataFile) return
	state.data = JSON.parse(state.rawData)

	const dataIteration = state.data.mmr.find(it => it.iteration == state.currentIteration)

	let dailyMMR       = []
	let dailyMMRRange  = []
	let dailyMMRWins   = []
	let dailyMMRLosses = []
	let dailyMMRResult = []
	let MMRWinSum      = []
	let MMRLossSum     = []
	let MMRSumResult   = []
	let MMRSumDeriv    = []
	let curMMR         = 0
	let minMMR         = 10000
	let maxMMR         = 0
	let mmrGames       = 0

	const MMR = dataIteration.games

	let winSum = 0, lossSum = 0
	let curDate = new Date(dataIteration.startDate), minDate
	let currWinStreak = 0, currLoseStreak = 0, maxWinStreak = 0, maxLoseStreak = 0
	let prevMMR
	for (let i = 0; i < MMR.length; i++) {
		let day = MMR[i]
		let win = 0, loss = 0
		let dayMin = curMMR, dayMax = curMMR
		if (day.length > 0) dayMin = dayMax = day[0]
	
		for (let j = 0; j < day.length; j++) {
			let diff = day[j] - curMMR;
			(diff > 0) ? win++ : loss++
			
			if (currLoseStreak != 0) {
				if (diff < 0) currLoseStreak++
				else {
					currLoseStreak = 0
					currWinStreak = 1
				}
				if (maxLoseStreak < currLoseStreak) maxLoseStreak = currLoseStreak
			}
			else {
				if (diff > 0) currWinStreak++
				else {
					currWinStreak = 0
					currLoseStreak = 1
				}
				if (maxWinStreak < currWinStreak) maxWinStreak = currWinStreak
			}
			
			curMMR = day[j]
			if (curMMR > dayMax) dayMax = curMMR
			if (curMMR < dayMin) dayMin = curMMR
			if (curMMR >= maxMMR) maxMMR = curMMR
			if (curMMR <= minMMR) { minMMR = curMMR; minDate = curDate.getTime() }
		}
	
		let t = curDate.getTime()
		curDate.setDate(curDate.getDate() + 1)
	
		dailyMMR[i]       = [t, curMMR]
		dailyMMRRange[i]  = [t, dayMin, dayMax]
		dailyMMRWins[i]   = [t, win]
		dailyMMRLosses[i] = [t, loss * -1]
		dailyMMRResult[i] = [t, win - loss]
		mmrGames         += day.length
		winSum           += win
		lossSum          += loss
		MMRWinSum[i]      = [t, winSum]
		MMRLossSum[i]     = [t, -lossSum]
		MMRSumResult[i]   = [t, winSum - lossSum]

		MMRSumDeriv[i]    = [t, prevMMR ? (winSum - lossSum) - prevMMR : 0]
		prevMMR           = winSum - lossSum
		//{name:t, x:t,y:v, color: cLost}
	}

	$('#dotabuff').attr('href', state.data.profile)
	$('#dotabuff > img').attr('src', state.data.avatar)
	//var minMMR = Math.min.apply(null, MMR);
	//var maxMMR = Math.max(...MMR);
	//var avgMMR = Math.round(MMR.reduce(function(p,c,i){return p+(c-p)/(i+1)}, 0));
	$('#games').text(mmrGames)
	$('#wins').text(winSum)
	$('#winRate').text(Math.round(100 * (winSum / mmrGames)) + "%")
	$('#minMMR').text(minMMR)
	$('#curMMR').text(curMMR)
	$('#maxMMR').text(maxMMR)
	$('#maxLoseStreak').text("-"+maxLoseStreak)
	$('#maxWinStreak').text("+"+maxWinStreak)
	
	function gcolor(cssClass) {
		let dummy = $('<div/>').addClass(cssClass).appendTo("body")
		let color = $(dummy).css('color')
		$(dummy).remove()
		return color
	}
	let cBack = gcolor('c-dark-gray')
	let cBase = gcolor('c-white')
	let cDisabled = gcolor('c-light-gray-2')
	let cLines = gcolor('c-light-gray-2')
	let cMMR = gcolor('c-blue')
	let cMMRRange = gcolor('c-light-blue')
	let cPlot = gcolor('c-light-blue')
	let cWon = gcolor('c-green')
	let cLost = gcolor('c-red')
	let cNet = gcolor('c-gold')
	
	Highcharts.setOptions({
		lang: { decimalPoint: '.', thousandsSep: ',' },
		chart: {
			style: { fontFamily: '\'Unica One\'' },
			backgroundColor: cBack,
			type: 'areaspline',
		},
		//title: { style: { color: cBase, fontSize: '20px', textTransform: 'uppercase' } },
		xAxis: {
			lineColor: cLines,
			tickColor: cLines,
			// labels: { formatter: function() { return 'Day '+ Highcharts.numberFormat(this.value, 0) ''; } },
			labels: { formatter: () => '' },
			type: 'datetime'
		},
		yAxis: {
			title: { text: '' },
			gridLineColor: cLines,
			lineColor: cLines,
			tickColor: cLines,
			labels: {
				style: { color: cBase, fontSize: '20px' },
				formatter: function() { return Highcharts.numberFormat(this.value, 0) }
			},
		},
		tooltip: {
			backgroundColor: 'rgba(17, 17, 17, 0.85)',
			style: { color: cBase, fontSize: '20px' },
			shared: true,
			//valuePrefix: '$',
			headerFormat: '<b>{point.key}</b><br>',
			xDateFormat: '%b %d, %Y'
		},
		plotOptions: {
			series: { marker: { enabled: false } },
			areaspline: { fillOpacity: 0.5 }
		},
		legend: {
			itemStyle: { color: cBase, fontSize: '20px' },
			itemHoverStyle: { color: cBase },
			itemHiddenStyle: { color: cDisabled },
		},
		credits: { enabled: false },
	})
	
	// Plot Lines
	function plot(date, color, text) {
		return {
			value: date,
			color: color,
			width: 2,
			//zIndex: 4,
			dashStyle: "shortdash",
			label: {
				text: text,
				align: "left",
				rotation: 90,
				style: {
					fontSize: "20px",
					color: color
				}
			}
		}
	}
	let plotLines = [ plot(minDate, cLost, "Lowest") ]
	dataIteration.plotlines.forEach(it => plotLines.push(plot(new Date(it[0]).getTime(), cPlot, it[1])))
	
	new Highcharts.Chart({
		chart: { renderTo: 'chart1' },
		title: { text: '' },
		xAxis: { plotLines: plotLines },
		yAxis: { min: minMMR },
		series: [{
			name: "MMR",
			color: cMMR,
			zIndex: 0,
			data: dailyMMR,
		},{
			//linkedTo: ':previous',
			name: 'Range',
			color: cMMRRange,
			fillOpacity: 0.6,
			type: 'areasplinerange',
			lineWidth: 0,
			zIndex: 1,
			data: dailyMMRRange,
	}]})
	new Highcharts.Chart({
		chart: { renderTo: 'chart2' },
		title: { text: '' },
		series: [{
			name: "Won",
			color: cWon,
			data: dailyMMRWins,
		},{
			name: "Lost",
			color: cLost,
			data: dailyMMRLosses,
		},{
			name: "Net",
			color: cNet,
			type: 'spline',
			data: dailyMMRResult,
	}]})
	new Highcharts.Chart({
		chart: { renderTo: 'chart3' },
		title: { text: '' },
		series: [{
			name: "Won",
			color: cWon,
			data: MMRWinSum,
		},{
			name: "Lost",
			color: cLost,
			data: MMRLossSum,
		},{
			name: "Net",
			color: cNet,
			type: 'spline',
			data: MMRSumResult,
	}]})
	new Highcharts.Chart({
		chart: { renderTo: 'chart4' },
		title: { text: '' },
		series: [{
			name: "Net 1st Derivative",
			color: cNet,
			data: MMRSumDeriv,
	}]})
}