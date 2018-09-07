const {remote} = require('electron')
const {Menu, MenuItem, dialog} = require('electron').remote
const Highcharts = require('highcharts-more-node')
const fs = require('fs')
const Store = require('electron-store')

const win = remote.getCurrentWindow()

let dataFile
let iteration = 'Current Season'
let rawData

let disablableMenuItems = []

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
		fs.writeFile(dataFile, rawDataStr, (err, rawDataStr) => {
			if (err) console.log(err)
			console.log('Write to file was successful')
		})

		rawData = Buffer.from(rawDataStr, 'utf8')
		calculateMMR(rawData, iteration)
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
        }
    })
	$('#save').click(saveFunc)

	$('#cancel').click(() => {
		$('#editMMR').hide()
		$('#charts').show()
	})

	dataFile = new Store().get('dataFile')
	if (dataFile) {
		$('#empty').hide()
		readMMR()
	} else {
		$('#empty').show()
	}
}

function setupRightClick() {
	const ctxMenu = new Menu()

	let item = new MenuItem({
		label: 'Edit MMR',
		click: () => {
			$('#rawData').val(rawData.toString('utf8'))
			$('#charts').hide()
			$('#editMMR').show()
		}
	})
	ctxMenu.append(item)
	disablableMenuItems.push(item)
	
	item = new MenuItem({
		label: 'Read MMR file',
		click: () => { readMMR() }
	})
	ctxMenu.append(item)
	disablableMenuItems.push(item)
	
	ctxMenu.append(new MenuItem({
		label: 'Select MMR file',
		click: () => {
			dialog.showOpenDialog((files) => {
				if (!dataFile) $('#empty').hide()
				dataFile = files[0]
				new Store().set('dataFile', dataFile)
				readMMR()
				$.each(disablableMenuItems, (index, value) => { value.enabled = true })
			})
		}
	}))
	
	ctxMenu.append(new MenuItem({ type: 'separator' }))
	
	item = new MenuItem({
		label: 'Current Season',
		click: () => {
			iteration = 'Current Season'
			calculateMMR(rawData, iteration)
		}
	})
	ctxMenu.append(item)
	disablableMenuItems.push(item)
	
	item = new MenuItem({
		label: 'Old Season',
		click: () => {
			iteration = 'Old Data'
			calculateMMR(rawData, iteration)
		}
	})
	ctxMenu.append(item)
	disablableMenuItems.push(item)
	
	ctxMenu.append(new MenuItem({ type: 'separator' }))
	
	ctxMenu.append(new MenuItem({
		label: 'DevTools',
		click: () => { win.webContents.openDevTools() }
	}))
	
	win.webContents.on('context-menu', () => { ctxMenu.popup(win) })

	disablableMenuItems.forEach(it => { it.enabled = (dataFile != undefined) })
}

function readMMR() {
	rawData = fs.readFileSync(dataFile)
	calculateMMR(rawData, iteration)
}

function calculateMMR(rawData, iteration) {
	const data = JSON.parse(rawData)
	const dataIteration = data.mmr.find(it => { return it.iteration === iteration })

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
	
	$('#dotabuff').attr('href', data.profile)
	$('#dotabuff > img').attr('src', data.avatar)
	//var minMMR = Math.min.apply(null, MMR);
	//var maxMMR = Math.max(...MMR);
	//var avgMMR = Math.round(MMR.reduce(function(p,c,i){return p+(c-p)/(i+1)}, 0));
	$('#minMMR').text(minMMR)
	$('#curMMR').text(curMMR)
	$('#maxMMR').text(maxMMR)
	$('#games').text(mmrGames)
	$('#winRate').text(Math.round(100 * (winSum / mmrGames)) + "%")
	$('#maxLoseStreak').text("-"+maxLoseStreak)
	$('#maxWinStreak').text("+"+maxWinStreak)
	
	function gcolor(cssClass) {
		let dummy = $('<div/>').addClass(cssClass).appendTo("body")
		let color = $(dummy).css('color')
		$(dummy).remove()
		return color
	}
	// Colors
	let cBack = gcolor('c-dark-gray')
	let cBase = gcolor('c-white')
	let cDisabled = gcolor('c-light-gray-2')
	let cLines = gcolor('c-light-gray-2')
	let cMMR = gcolor('c-blue')
	let cMMRRange = cPlot = gcolor('c-light-blue')
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
			labels: { formatter: function() { return /*'Day '+ Highcharts.numberFormat(this.value, 0)*/ ''; } },
			type: 'datetime'
		},
		yAxis: {
			title: { text: '' },
			gridLineColor: cLines,
			lineColor: cLines,
			tickColor: cLines,
			labels: {
				style: { color: cBase, fontSize: '20px' },
				formatter: function() { return Highcharts.numberFormat(this.value, 0); }
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
	for (let i = 0; i < dataIteration.plotlines.length; i++)
		plotLines.push( plot(new Date(dataIteration.plotlines[i][0]).getTime(), cPlot, dataIteration.plotlines[i][1]) )
	
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