"use strict";

class WinBar {
    constructor(window, elementName, title, ...extraClasses) {
        this.elementName = '#' + elementName
        this._title = title

        let minBtn = $('<div/>').attr('id', 'winBar-btn-min').addClass('winBar-btn').html('&#xE921;').click(() => window.minimize())
        let maxBtn = $('<div/>').attr('id', 'winBar-btn-max').addClass('winBar-btn').html('&#xE922;')
        let restoreBtn = $('<div/>').attr('id', 'winBar-btn-restore').addClass('winBar-btn').html('&#xE923;')
        let closeBtn = $('<div/>').attr('id', 'winBar-btn-close').addClass('winBar-btn').html('&#xE8BB;').click(() => window.close())

        let toggleMaxRestoreButtons = () => {
            if (window.isMaximized()) {
                maxBtn.hide()
                restoreBtn.css('display', 'flex')
            } else {
                maxBtn.css('display', 'flex')
                restoreBtn.hide()
            }
        }

        maxBtn.click(() => {
            window.maximize()
            toggleMaxRestoreButtons()
        })

        restoreBtn.click(() => {
            window.unmaximize()
            toggleMaxRestoreButtons()
        })

        $(this.elementName).empty().addClass(['winBar'].concat(extraClasses).join(' ')).append(
            $('<div/>').attr('id', 'winBar-drag-region')
            .append($('<div/>').attr('id', 'winBar-title').text(title))
            .append(
                $('<div/>').attr('id', 'winBar-controls')
                .append(minBtn).append(maxBtn).append(restoreBtn).append(closeBtn)
            )
        )

        toggleMaxRestoreButtons()
        window.on('maximize', toggleMaxRestoreButtons)
	    window.on('unmaximize', toggleMaxRestoreButtons)
    }

    tempTitle(title) { $('#winBar-title').text(this._title + title) }

    restoreTitle() { $('#winBar-title').text(this._title) }
}

module.exports = WinBar