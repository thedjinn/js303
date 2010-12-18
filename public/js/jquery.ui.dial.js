/*
 * jQuery UI Dial 0.1.0
 *
 * Copyright 2010 Emil Loer (http://koffietijd.net)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * https://github.com/thedjinn/jquery-ui-dial
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.widget.js
 *	jquery.ui.mouse.js
 *	jquery.ui.draggable.js
 */
(function($, undefined) {
	$.widget("ui.dial", {
		options: {
			min: -100,
			max: 100,
			value: 0,
			unitsPerPixel: 1,

			numImages: 10,
			imageWidth: 32
		},

		_create: function() {
			this._value = this.options.value;
			this._origValue = this._value;

			var self = this;

			this.element.addClass("ui-dial");
			this.element.draggable({
				axis: 'y',
				helper: 'original',
				scroll: false,
				cursor: 'row-resize',
				addClasses: false,

				drag: function(event, ui) {
					var val = (self._origValue + (ui.position.top - ui.originalPosition.top) * -self.options.unitsPerPixel);
					ui.position = ui.originalPosition;
					self.value(val);

					self._trigger("change", event, {value: self._value});
				},

				start: function(event, ui) {
					self._origValue = self._value;
					self._trigger("start", event, {value: self._value});
				},

				stop: function(event, ui) {
					self._trigger("stop", event, {value: self._value});
				}
			});

			this._update();
		},

		destroy: function() {
			$.Widget.prototype.destroy.apply(this, arguments);
		},

		value: function(newValue) {
			if (newValue === undefined) {
				return this._value;
			}

			if (typeof newValue === "number") {
				this._value = newValue;
				this._value = Math.max(this._value, this.options.min);
				this._value = Math.min(this._value, this.options.max);
				this._update();
			}

			return this;
		},

		_update: function() {
			var pos = Math.round((this._value - this.options.min) / (this.options.max - this.options.min) * (this.options.numImages - 1)) * this.options.imageWidth;

			this.element.css("background-position", "-" + pos + "px 0");
		}
	});
})(jQuery);
