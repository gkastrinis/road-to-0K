"use strict";

class Menu {
	constructor(elementName, ...extraClasses) {
		$('body').append($('<div/>').attr('id', elementName))
        this.elementName = '#' + elementName
        $(this.elementName).empty()
        $(this.elementName).addClass(['menu'].concat(extraClasses).join(' '))

		document.addEventListener('contextmenu', e => {
			e.preventDefault()
			$(this.elementName).css({
				display: "block",
				position: "absolute",
				top: e.pageY,
				left: e.pageX,
			})
		}, false)

		document.addEventListener('click', e => $(this.elementName).hide())
	}

	addItem(item) {
        if (item instanceof MenuSeparator) {
            $(this.elementName).append($('<hr/>').addClass('menu-separator'))
        } else {
            let el = $('<span/>').text(item.text)
            item.isEnabled ? el.click(item.callBack) : el.addClass('menu-disabled')
            $(this.elementName).append(el)
        }
	}
}

class MenuItem {
    constructor(text, callBack, isEnabled) {
		this._text = text
		this._callBack = callBack
        this._isEnabled = isEnabled
	}

	get text() { return this._text }

    get callBack() { return this._callBack }
    
    get isEnabled() { return this._isEnabled }
}

class MenuSeparator extends MenuItem {}

module.exports = {
    Menu: Menu,
    MenuItem: MenuItem,
    MenuSeparator: MenuSeparator
}