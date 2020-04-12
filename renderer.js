const {remote} = require('electron');
const {dialog} = require('electron').remote;
const Highcharts = require('highcharts-more-node');
const fs = require('fs');
const Store = require('electron-store');
const WinBar = require('./winbar.js');
const {Menu, MenuItem, MenuSeparator} = require('./menu.js');

const win = remote.getCurrentWindow();
const winBar = new WinBar(win, 'winBar', 'Road to 0K');
const state = {dataFile: new Store().get('dataFile')};

const RANKS = {
	'HERALD1': 'https://gamepedia.cursecdn.com/dota2_gamepedia/8/85/SeasonalRank1-1.png',
	'HERALD2': 'https://gamepedia.cursecdn.com/dota2_gamepedia/e/ee/SeasonalRank1-2.png',
	'HERALD3': 'https://gamepedia.cursecdn.com/dota2_gamepedia/0/05/SeasonalRank1-3.png',
	'HERALD4': 'https://gamepedia.cursecdn.com/dota2_gamepedia/6/6d/SeasonalRank1-4.png',
	'HERALD5': 'https://gamepedia.cursecdn.com/dota2_gamepedia/2/2b/SeasonalRank1-5.png',
	'GUARDIAN1': 'https://gamepedia.cursecdn.com/dota2_gamepedia/c/c7/SeasonalRank2-1.png',
	'GUARDIAN2': 'https://gamepedia.cursecdn.com/dota2_gamepedia/2/2c/SeasonalRank2-2.png',
	'GUARDIAN3': 'https://gamepedia.cursecdn.com/dota2_gamepedia/f/f5/SeasonalRank2-3.png',
	'GUARDIAN4': 'https://gamepedia.cursecdn.com/dota2_gamepedia/b/b4/SeasonalRank2-4.png',
	'GUARDIAN5': 'https://gamepedia.cursecdn.com/dota2_gamepedia/3/32/SeasonalRank2-5.png',
	'CRUSADER1': 'https://gamepedia.cursecdn.com/dota2_gamepedia/8/82/SeasonalRank3-1.png',
	'CRUSADER2': 'https://gamepedia.cursecdn.com/dota2_gamepedia/6/6e/SeasonalRank3-2.png',
	'CRUSADER3': 'https://gamepedia.cursecdn.com/dota2_gamepedia/6/67/SeasonalRank3-3.png',
	'CRUSADER4': 'https://gamepedia.cursecdn.com/dota2_gamepedia/8/87/SeasonalRank3-4.png',
	'CRUSADER5': 'https://gamepedia.cursecdn.com/dota2_gamepedia/b/b1/SeasonalRank3-5.png',
};

(() => {
	if (state.dataFile) {
		loadFile();
		calculateMMR();
		redraw();
	}

	////// Editor //////
	$(document).keydown(event => {
		let editorVisible = $('#editMMR').is(':visible');
		// Ctrl + S
		if (editorVisible && (event.ctrlKey || event.metaKey) && event.which === 83) {
			event.preventDefault();
			saveAndCloseEditor();
			return false;
		}
		// Esc
		else if (event.which === 27) {
			event.preventDefault();
			if (editorVisible) closeEditor();
			else if ($('#purge').is(':visible')) {
				$('#purge').hide();
				$('#charts').show();
			}
			return false;
		}
	});
	$('#save').click(saveAndCloseEditor);
	$('#cancel').click(closeEditor);

	////// Right Click Menu //////
	(function f() {
		const menu = new Menu('menu', 'c-b-dark-gray-2');
		menu.addItem(new MenuItem('Edit MMR', openEditor, !!state.dataFile));
		menu.addItem(new MenuItem('Reload', () => {
			loadFile();
			calculateMMR();
		}, !!state.dataFile));
		menu.addItem(new MenuItem('MMR file', () => {
			dialog.showOpenDialog()
			.then(result=> {
				if(result.canceled) return;
				state.dataFile = result.filePaths[0];
				new Store().set('dataFile', state.dataFile);
				loadFile();
				calculateMMR();
				f();
			});
		}, true));

		if (state.seasonNames) {
			menu.addItem(new MenuSeparator(null, null, null));
			state.seasonNames.forEach(currSeasonName => {
				menu.addItem(new MenuItem(currSeasonName, () => {
					state.currentSeason = state.data.seasons.find(it => it.name === currSeasonName);
					calculateMMR();
				}, true))
			});
		}

		menu.addItem(new MenuSeparator(null, null, null));
		menu.addItem(new MenuItem('Purge YT Videos', () => {
			$('#charts').hide();
			$('#purge').show();
		}, true));
		menu.addItem(new MenuSeparator(null, null, null));
		menu.addItem(new MenuItem('DevTools', () => win.webContents.openDevTools(), true))
	})();

	////// Purge YT Videos //////
	let css = {display: "flex", flexWrap: "wrap", justifyContent: "center"};
	$('#purge').hide().prepend($('<div/>').css(css));
	$('#purge > div:nth-child(1)').append($('<iframe width="1280" height="720" src="https://www.youtube.com/embed/videoseries?list=PLx5AyE42HmyXadgEkkIK51Ph8ltBBgDX2"/>'));
	$('#back').click(() => {
		$('#purge').hide();
		$('#charts').show();
		redraw()
	});
})();

function redraw() {
	let {width, height} = win.getBounds();
	win.setSize(width + 1, height + 1);
	setTimeout(() => win.setSize(width, height), 1000);
}

function openEditor() {
	winBar.tempTitle(" - " + new Date().toDateString());
	$('#charts').hide();
	$('#editMMR').show();

	let currDate = new Date(state.currentSeason.startDate);
	currDate.setHours(0, 0, 0, 0);
	let today = new Date();
	today.setHours(0, 0, 0, 0);
	let i = 0;
	let element = $('#editMMR > div:nth-child(1)');
	element.empty();
	while (currDate.getTime() <= today.getTime()) {
		let games = state.currentSeason.games[i];
		element.prepend($('<div/>')
			.append($('<span/>').text(currDate.toDateString()))
			.append($('<input/>').val(games ? games.join(',') : '')));
		currDate.setDate(currDate.getDate() + 1);
		i++;
	}
	$('#editMMR > div:nth-child(1) > div:first-child > input').focus();

	element = $('#editMMR > div:nth-child(2)');
	element.empty();
	state.currentSeason.plotlines.forEach(it => element.prepend($('<input/>').val(it)));
	element.append($('<a href="#" id="add" class="btn-lg btn-secondary">+</a>').click(() => element.prepend($('<input/>'))));

	redraw()
}

function closeEditor() {
	winBar.restoreTitle();
	$('#editMMR').hide();
	$('#charts').show();

	redraw()
}

function saveAndCloseEditor() {
	let games = [];
	$('#editMMR > div:nth-child(1) input').each((i, element) => {
		games.unshift($(element).val() ? $(element).val().split(',').map(it => parseInt(it)) : []);
	});
	state.currentSeason.games = games;
	let plotlines = [];
	$('#editMMR > div:nth-child(2) input').each((i, element) => {
		let val = $(element).val().trim();
		if (val) plotlines.unshift(val.split(','));
	});
	state.currentSeason.plotlines = plotlines;
	// fs.writeFile(state.dataFile, JSON.stringify(state.data), (e) => console.log(e));
	fs.writeFile(state.dataFile, JSON.stringify(state.data, null, 2), (e) => console.log(e));
	calculateMMR();
	closeEditor();
}

function loadFile() {
	try {
		console.log(state.dataFile);
		state.rawData = fs.readFileSync(state.dataFile);
		$('#empty').hide();
	} catch (err) {
		console.log(err);
		state.dataFile = undefined;
		return;
	}
	state.data = JSON.parse(state.rawData);
	state.seasonNames = state.data.seasons.map(it => it.name);
	state.currentSeason = state.data.seasons.find(it => it.name === state.seasonNames[0]);
}


function calculateMMR() {
	if (!state.dataFile) return;

	let dailyMMR = [];
	let dailyMMRRange = [];
	let dailyMMRWins = [];
	let dailyMMRLosses = [];
	let dailyMMRResult = [];
	let MMRWinSum = [];
	let MMRLossSum = [];
	let MMRSumResult = [];
	let MMRSumDeriv = [];
	let currMMR = 0;
	let prevMMR;
	let minMMR = 10000;
	let maxMMR = 0;
	let mmrGames = 0;
	let winSum = 0, lossSum = 0;
	let currDate = new Date(state.currentSeason.startDate), minDate;
	let currWinStreak = 0, currLoseStreak = 0, maxWinStreak = 0, maxLoseStreak = 0;

	state.currentSeason.games.forEach((day, i) => {
		let win = 0, loss = 0;
		let dayMin = currMMR, dayMax = currMMR;
		if (day.length > 0) dayMin = dayMax = day[0];

		day.forEach(mmr => {
			let diff = mmr - currMMR;
			(diff > 0) ? win++ : loss++;

			if (currLoseStreak !== 0) {
				if (diff < 0) currLoseStreak++;
				else {
					currLoseStreak = 0;
					currWinStreak = 1;
				}
				if (maxLoseStreak < currLoseStreak) maxLoseStreak = currLoseStreak;
			}
			else {
				if (diff > 0) currWinStreak++;
				else {
					currWinStreak = 0;
					currLoseStreak = 1;
				}
				if (maxWinStreak < currWinStreak) maxWinStreak = currWinStreak;
			}

			currMMR = mmr;
			if (currMMR > dayMax) dayMax = currMMR;
			if (currMMR < dayMin) dayMin = currMMR;
			if (currMMR >= maxMMR) maxMMR = currMMR;
			if (currMMR <= minMMR) {
				minMMR = currMMR;
				minDate = currDate.getTime();
			}
		});
		let t = currDate.getTime();
		currDate.setDate(currDate.getDate() + 1);

		dailyMMR[i] = [t, currMMR];
		dailyMMRRange[i] = [t, dayMin, dayMax];
		dailyMMRWins[i] = [t, win];
		dailyMMRLosses[i] = [t, loss * -1];
		dailyMMRResult[i] = [t, win - loss];
		mmrGames += day.length;
		winSum += win;
		lossSum += loss;
		MMRWinSum[i] = [t, winSum];
		MMRLossSum[i] = [t, -lossSum];
		MMRSumResult[i] = [t, winSum - lossSum];

		MMRSumDeriv[i] = [t, prevMMR ? (winSum - lossSum) - prevMMR : 0];
		prevMMR = winSum - lossSum;
	});

	$('#dotabuff').attr('href', state.data.profile);
	$('#dotabuff > img:nth-child(1)').attr('src', state.data.avatar).addClass('rounded-circle');
	$('#dotabuff > img:nth-child(2)').attr('src', RANKS[state.currentSeason.currentRank]);

	$('#games').text(mmrGames);
	$('#wins').text(winSum);
	$('#winRate').text(Math.round(100 * (winSum / mmrGames)) + "%");
	$('#minMMR').text(minMMR);
	$('#currMMR').text(currMMR).removeClass('c-green c-red c-gold').addClass(((currMMR === maxMMR) ? 'c-green' : (currMMR === minMMR ? 'c-red' : 'c-gold')));//.append($('<i/>').addClass('fa'));
	$('#maxMMR').text(maxMMR);
	$('#maxLoseStreak').text("-" + maxLoseStreak);
	$('#maxWinStreak').text("+" + maxWinStreak);

	function gcolor(cssClass) {
		let dummy = $('<div/>').addClass(cssClass).appendTo("body");
		let color = $(dummy).css('color');
		$(dummy).remove();
		return color
	}

	let cBack = gcolor('c-dark-gray');
	let cBase = gcolor('c-white');
	let cDisabled = gcolor('c-light-gray-2');
	let cLines = gcolor('c-light-gray-2');
	let cMMR = gcolor('c-blue');
	let cMMRRange = gcolor('c-light-blue');
	let cPlot = gcolor('c-light-blue');
	let cWon = gcolor('c-green');
	let cLost = gcolor('c-red');
	let cNet = gcolor('c-gold');

	Highcharts.setOptions({
		lang: {decimalPoint: '.', thousandsSep: ','},
		chart: {
			style: {fontFamily: '\'Unica One\''},
			backgroundColor: cBack,
			type: 'areaspline',
		},
		//title: { style: { color: cBase, fontSize: '20px', textTransform: 'uppercase' } },
		xAxis: {
			lineColor: cLines,
			tickColor: cLines,
			// labels: { formatter: function() { return 'Day '+ Highcharts.numberFormat(this.value, 0) ''; } },
			labels: {formatter: () => ''},
			type: 'datetime'
		},
		yAxis: {
			title: {text: ''},
			gridLineColor: cLines,
			lineColor: cLines,
			tickColor: cLines,
			labels: {
				style: {color: cBase, fontSize: '20px'},
				formatter: function () {
					return Highcharts.numberFormat(this.value, 0)
				}
			},
		},
		tooltip: {
			backgroundColor: 'rgba(17, 17, 17, 0.85)',
			style: {color: cBase, fontSize: '20px'},
			shared: true,
			//valuePrefix: '$',
			headerFormat: '<b>{point.key}</b><br>',
			xDateFormat: '%b %d, %Y'
		},
		plotOptions: {
			series: {marker: {enabled: false}},
			areaspline: {fillOpacity: 0.5}
		},
		legend: {
			itemStyle: {color: cBase, fontSize: '20px'},
			itemHoverStyle: {color: cBase},
			itemHiddenStyle: {color: cDisabled},
		},
		credits: {enabled: false},
	});

	// Handle bug in plotlines text
	Highcharts.wrap(Highcharts.Axis.prototype, 'getPlotLinePath', function(proceed) {
		var path = proceed.apply(this, Array.prototype.slice.call(arguments, 1));
		if (path) path.flat = false;
		return path;
	});

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

	let plotLines = [plot(minDate, cLost, "Lowest")];
	state.currentSeason.plotlines.forEach(it => plotLines.push(plot(new Date(it[0]).getTime(), cPlot, it[1])));

	new Highcharts.Chart({
		chart: {renderTo: 'chart1'},
		title: {text: ''},
		xAxis: {plotLines: plotLines},
		yAxis: {min: minMMR},
		series: [{
			name: "MMR",
			color: cMMR,
			zIndex: 0,
			data: dailyMMR,
		}, {
			//linkedTo: ':previous',
			name: 'Range',
			color: cMMRRange,
			fillOpacity: 0.6,
			type: 'areasplinerange',
			lineWidth: 0,
			zIndex: 1,
			data: dailyMMRRange,
		}]
	});
	new Highcharts.Chart({
		chart: {renderTo: 'chart2'},
		title: {text: ''},
		series: [{
			name: "Won",
			color: cWon,
			data: dailyMMRWins,
		}, {
			name: "Lost",
			color: cLost,
			data: dailyMMRLosses,
		}, {
			name: "Net",
			color: cNet,
			type: 'spline',
			data: dailyMMRResult,
		}]
	});
	new Highcharts.Chart({
		chart: {renderTo: 'chart3'},
		title: {text: ''},
		series: [{
			name: "Won",
			color: cWon,
			data: MMRWinSum,
		}, {
			name: "Lost",
			color: cLost,
			data: MMRLossSum,
		}, {
			name: "Net",
			color: cNet,
			type: 'spline',
			data: MMRSumResult,
		}]
	});
	new Highcharts.Chart({
		chart: {renderTo: 'chart4'},
		title: {text: ''},
		series: [{
			name: "Net 1st Derivative",
			color: cNet,
			data: MMRSumDeriv,
		}]
	});
}