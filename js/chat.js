/*
 * This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/.
 *
 * Based off of Julian Garnier's original project, juliangarnier.com. The code from the original
 * project has been modified here by Chris Valmonte.
 *
 * Copyright (c) 2016 Julian Garnier
 */

window.onload = function() {
	var fab = document.querySelector('#reply-fab > a');
	fab.className += 'open';

	if (Messages.sent())
		Messages.displaySent();
	else {
		Messages.setCookie();
		Messages.send();
	}
}


var Messages = (function() {

	var _messagesEl = document.querySelector('.messages');
	var _typingSpeed = 20;
	var _loadingText = '<b>•</b><b>•</b><b>•</b>';
	var _messageIndex = 0;

	var _getCurrentTime = function() {
		var date = new Date();
		var hours =  date.getHours();
		var minutes =  date.getMinutes();
		return hours + (minutes * .01);
	}

	var _getCurrentTimeMessage = function() {
		if (_getCurrentTime() >= 5 && _getCurrentTime() < 17) return 'Have a nice day!';
		if (_getCurrentTime() >= 17 && _getCurrentTime() < 19) return 'Have a good evening!';
		if (_getCurrentTime() >= 19 || _getCurrentTime() < 5) return 'Have a good night!';
	}

	var _messages = [
		'Hey there 👋',
		'Want to connect?',
		'Say <a href="mailto:hello@chrisvalmonte.com">hello@chrisvalmonte.com</a>',
		'You can also find me at<br>various places on the web',
		'<a href="https://github.com/chrisvalmonte" target="_blank">github.com/chrisvalmonte</a><br><a href="https://behance.net/chrisvalmonte" target="_blank">behance.net/chrisvalmonte</a><br><a href="https://linkedin.com/in/chrisvalmonte" target="_blank">linkedin.com/in/chrisvalmonte</a>',
		_getCurrentTimeMessage(),
	]

	var _getFontSize = function() {
		return parseInt(getComputedStyle(document.body).getPropertyValue('font-size'));
	}

	var _pxToRem = function(px) {
		return px / _getFontSize() + 'rem';
	}

	var _createBubbleElements = function(message, position) {
		var bubbleEl = document.createElement('div');
		var messageEl = document.createElement('span');
		var loadingEl = document.createElement('span');
		bubbleEl.classList.add('bubble');
		bubbleEl.classList.add('is-loading');
		bubbleEl.classList.add('cornered');
		bubbleEl.classList.add(position === 'right' ? 'right' : 'left');
		messageEl.classList.add('message');
		loadingEl.classList.add('loading');
		messageEl.innerHTML = message;
		loadingEl.innerHTML = _loadingText;
		bubbleEl.appendChild(loadingEl);
		bubbleEl.appendChild(messageEl);
		bubbleEl.style.opacity = 0;
		return {
			bubble: bubbleEl,
			message: messageEl,
			loading: loadingEl
		}
	}

	var _getDimensions = function(elements) {
		return dimensions = {
			loading: {
				w: '4rem',
				h: '2.25rem'
			},
			bubble: {
				w: _pxToRem(elements.bubble.offsetWidth + 4),
				h: _pxToRem(elements.bubble.offsetHeight)
			},
			message: {
				w: _pxToRem(elements.message.offsetWidth + 4),
				h: _pxToRem(elements.message.offsetHeight)
			}
		}
	}

	var _prepareMessage = function(message, position) {
		var loadingDuration = (message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed) + 500;
		var elements = _createBubbleElements(message, position);
		_messagesEl.appendChild(elements.bubble);
		_messagesEl.appendChild(document.createElement('br'));
		var dimensions = _getDimensions(elements);
		elements.bubble.style.width = '0rem';
		elements.bubble.style.height = dimensions.loading.h;
		elements.message.style.width = dimensions.message.w;
		elements.message.style.height = dimensions.message.h;
		elements.bubble.style.opacity = 1;
		var bubbleOffset = elements.bubble.offsetTop + elements.bubble.offsetHeight;
		if (bubbleOffset > _messagesEl.offsetHeight) {
			var scrollMessages = anime({
				targets: _messagesEl,
				scrollTop: bubbleOffset,
				duration: 750
			});
		}
		var bubbleSize = anime({
			targets: elements.bubble,
			width: ['0rem', dimensions.loading.w],
			marginTop: ['2.5rem', 0],
			marginLeft: ['-2.5rem', 0],
			duration: 800,
			easing: 'easeOutElastic'
		});
		var loadingLoop = anime({
			targets: elements.bubble,
			scale: [1.05, .95],
			duration: 1100,
			loop: true,
			direction: 'alternate',
			easing: 'easeInOutQuad'
		});
		var dotsStart = anime({
			targets: elements.loading,
			translateX: ['-2rem', '0rem'],
			scale: [.5, 1],
			duration: 400,
			delay: 25,
			easing: 'easeOutElastic',
		});
		var dotsPulse = anime({
			targets: elements.bubble.querySelectorAll('b'),
			scale: [1, 1.25],
			opacity: [.5, 1],
			duration: 300,
			loop: true,
			direction: 'alternate',
			delay: function(i) {return (i * 100) + 50}
		});
		setTimeout(function() {
			loadingLoop.pause();
			dotsPulse.restart({
				opacity: 0,
				scale: 0,
				loop: false,
				direction: 'forwards',
				update: function(a) {
					if (a.progress >= 65 && elements.bubble.classList.contains('is-loading')) {
						elements.bubble.classList.remove('is-loading');
						anime({
							targets: elements.message,
							opacity: [0, 1],
							duration: 300,
						});
					}
				}
			});
			bubbleSize.restart({
				scale: 1,
				width: [dimensions.loading.w, dimensions.bubble.w ],
				height: [dimensions.loading.h, dimensions.bubble.h ],
				marginTop: 0,
				marginLeft: 0,
				begin: function() {
					if (_messageIndex < _messages.length) elements.bubble.classList.remove('cornered');
				}
			})
		}, loadingDuration - 50);
	}



	var COOKIE_KEY = 'chrissaid';
	var COOKIE_VALUE = _getCurrentTimeMessage();

	var checkMessageCookie = function() {
		if (!Cookies.get(COOKIE_KEY))
			return false;

		return true;
	}

	var setMessageCookie = function() {
		Cookies.set(COOKIE_KEY, COOKIE_VALUE, { expires: 1 });
	}

	var displaySentMessages = function() {
		var msgContainer = document.getElementsByClassName('messages')[0];

		for (var i = 0; i < _messages.length - 1; i++) {
			var message = document.createElement('div');
			message.className += 'bubble left';
			message.innerHTML = _messages[i];
			msgContainer.appendChild(message);
			msgContainer.appendChild(document.createElement('br'));
		}

		// Current Time Message
		var current = document.createElement('div');
		current.className += 'bubble left cornered';
		current.innerHTML = Cookies.get(COOKIE_KEY);
		msgContainer.appendChild(current);
		msgContainer.appendChild(document.createElement('br'));
	}

	var sendMessages = function() {
		var message = _messages[_messageIndex];
		if (!message) return;
		_prepareMessage(message);
		++_messageIndex;
		setTimeout(sendMessages, (message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed) + anime.random(900, 1200));
	}



	return {
		sent: checkMessageCookie,
		displaySent: displaySentMessages,
		setCookie: setMessageCookie,
		send: sendMessages,
	};

})();