const {remote} = require('electron')
const {Menu, MenuItem, dialog} = require('electron').remote
const Highcharts = require('highcharts-more-node')
const fs = require('fs')
const Store = require('electron-store')

const win = remote.getCurrentWindow()

let state = {}
initWindowControls()
initContents()
setupRightClick()

function initWindowControls() {
	$('#min-button').click(event => { win.minimize() })
	$('#max-button').click(event => { win.maximize() ; toggleMaxRestoreButtons() })
	$('#restore-button').click(event => { win.unmaximize() ; toggleMaxRestoreButtons() })
	$('#close-button').click(event => { win.close() })

	toggleMaxRestoreButtons()
	win.on('maximize', toggleMaxRestoreButtons)
	win.on('unmaximize', toggleMaxRestoreButtons)

	function toggleMaxRestoreButtons() {
		if (win.isMaximized()) {
			$('#max-button').hide()
			$('#restore-button').css('display', 'flex')
		} else {
			$('#max-button').css('display', 'flex')
			$('#restore-button').hide()
		}
	}
}

function initContents() {
	$('#editMMR').hide()

	let saveFunc = () => {
		let rawDataStr = $('#rawData').val()
		fs.writeFile(state.dataFile, rawDataStr, (err, rawDataStr) => {
			if (err) console.log(err)
			console.log('Write to file was successful')
		})

		state.rawData = Buffer.from(rawDataStr, 'utf8')
		calculateMMR()
		$('#editMMR').hide()
		$('#charts').show()
	}
	let cancelFunc = () => {
		$('#editMMR').hide()
		$('#charts').show()
	}

	$(document).keydown(event => {
        // If Control or Command key is pressed and the S key is pressed
        // run save function. 83 is the key code for S.
        if ($('#editMMR').is(':visible') && (event.ctrlKey || event.metaKey) && event.which == 83) {
			event.preventDefault()
			saveFunc()
            return false
		} else if (event.which == 27) {
			event.preventDefault()
			cancelFunc()
            return false
		}
    })
	
	$('#save').click(saveFunc)
	$('#cancel').click(cancelFunc)

	state.dataFile = new Store().get('dataFile')
	if (state.dataFile) {
		$('#empty').hide()
		readJSON()
		calculateMMR()
		calculateMMR() // TODO: HACK!!!
	} else {
		$('#empty').show()
	}
}

function setupRightClick() {
	readJSON()

	const ctxMenu = new Menu()

	ctxMenu.append(new MenuItem({
		label: 'Edit MMR',
		enabled: state.dataFile != undefined,
		click: () => {
			$('#rawData').val(state.rawData.toString('utf8'))
			$('#charts').hide()
			$('#editMMR').show()
		}
	}))
	
	ctxMenu.append(new MenuItem({
		label: 'Read MMR file',
		enabled: state.dataFile != undefined,
		click: () => {
			readJSON()
			calculateMMR()
		}
	}))
	
	ctxMenu.append(new MenuItem({
		label: 'Select MMR file',
		click: () => {
			dialog.showOpenDialog(files => {
				if (!state.dataFile) $('#empty').hide()
				state.dataFile = files[0]
				new Store().set('dataFile', state.dataFile)
				readJSON()
				calculateMMR()
				setupRightClick()
			})
		}
	}))

	if (state.iterations) {
		ctxMenu.append(new MenuItem({ type: 'separator' }))
		state.iterations.forEach(it => {
			ctxMenu.append(new MenuItem({
				label: it,
				click: () => {
					state.currentIteration = it
					calculateMMR()
				}
			}))
		})	
	}
	
	ctxMenu.append(new MenuItem({ type: 'separator' }))
	ctxMenu.append(new MenuItem({
		label: 'DevTools',
		click: () => { win.webContents.openDevTools() }
	}))
	
	win.webContents.on('context-menu', () => { ctxMenu.popup(win) })
}

function readJSON() {
	if (!state.dataFile) return
	state.rawData = fs.readFileSync(state.dataFile)
	state.data = JSON.parse(state.rawData)
	state.iterations = state.data.mmr.map(it => it.iteration)
	state.currentIteration = state.iterations[0]
}

function calculateMMR() {
	const dataIteration = state.data.mmr.find(it => it.iteration == state.currentIteration)

	let dailyMMR       = []
	let dailyMMRRange  = []
	let dailyMMRWins   = []
	let dailyMMRLosses = []
	let dailyMMRResult = []
	let MMRWinSum      = []
	let MMRLossSum     = []
	let MMRSumResult   = []
	let curMMR         = 0
	let minMMR         = 10000
	let maxMMR         = 0
	let mmrGames       = 0

	const MMR = dataIteration.games
	
	let winSum = 0, lossSum = 0
	let curDate = new Date(dataIteration.startDate), minDate
	let currWinStreak = 0, currLoseStreak = 0, maxWinStreak = 0, maxLoseStreak = 0
	for (var i = 0; i < MMR.length; i++) {
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
			if (curMMR > maxMMR) maxMMR = curMMR
			if (curMMR < minMMR) { minMMR = curMMR; minDate = curDate.getTime() }
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
	
	// Charts
	new Highcharts.Chart({
		chart: { renderTo: 'chart1' },
		title: { text: '' },
		xAxis: { plotLines: plotLines },
		yAxis: { min: minMMR },
		series: [{
			name: "Solo MMR",
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
}