/*
 * This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/.
 *
 * Based off of Julian Garnier's original project, juliangarnier.com. The code from the original
 * project has been modified here by Chris Valmonte.
 *
 * Copyright (c) 2016 Julian Garnier
 */

window.onload = function () {
  const fab = document.querySelector('.fab > a');
  fab.className += 'open';

  if (Messages.sent()) Messages.displaySent();
  else {
    Messages.setCookie();
    Messages.send();
  }
};

const Messages = (function () {
  const _messagesEl = document.querySelector('.messages');
  const _typingSpeed = 20;
  const _loadingText = '<b>•</b><b>•</b><b>•</b>';
  let _messageIndex = 0;

  // TODO: Add back when needed again
  // var _getCurrentTime = function () {
  //   var date = new Date();
  //   var hours = date.getHours();
  //   var minutes = date.getMinutes();
  //   return hours + minutes * 0.01;
  // };

  // var _getCurrentTimeMessage = function () {
  //   if (_getCurrentTime() >= 5 && _getCurrentTime() < 17)
  //     return 'Have a nice day!';
  //   if (_getCurrentTime() >= 17 && _getCurrentTime() < 19)
  //     return 'Have a good evening!';
  //   if (_getCurrentTime() >= 19 || _getCurrentTime() < 5)
  //     return 'Have a good night!';
  // };

  const _messages = [
    'Hey there 👋',
    "I'm Chris",
    'I design and code things on the web',
    'Currently tracking COVID-19 at<br/><a href="https://covid19-confirmed.com" rel="noopener noreferrer" target="_blank">covid19-confirmed.com</a>',
    '<a href="https://behance.net/chrisvalmonte" rel="noopener noreferrer" target="_blank">behance.net/chrisvalmonte</a><br><a href="https://github.com/chrisvalmonte" rel="noopener noreferrer" target="_blank">github.com/chrisvalmonte</a><br><a href="https://linkedin.com/in/chrisvalmonte" rel="noopener noreferrer" target="_blank">linkedin.com/in/chrisvalmonte</a>',
    'Say <a href="mailto:hello@chrisvalmonte.com">hello@chrisvalmonte.com</a>',
    'Stay home. Stay healthy.',
    // _getCurrentTimeMessage(),
  ];

  const _getFontSize = function () {
    return parseInt(
      getComputedStyle(document.body).getPropertyValue('font-size'),
    );
  };

  const _pxToRem = function (px) {
    return px / _getFontSize() + 'rem';
  };

  const _createBubbleElements = function (message, position) {
    const bubbleEl = document.createElement('div');
    const messageEl = document.createElement('span');
    const loadingEl = document.createElement('span');

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
      loading: loadingEl,
    };
  };

  const _getDimensions = function (elements) {
    return (dimensions = {
      loading: {
        w: '4rem',
        h: '2.25rem',
      },
      bubble: {
        w: _pxToRem(elements.bubble.offsetWidth + 4),
        h: _pxToRem(elements.bubble.offsetHeight),
      },
      message: {
        w: _pxToRem(elements.message.offsetWidth + 4),
        h: _pxToRem(elements.message.offsetHeight),
      },
    });
  };

  const _prepareMessage = function (message, position) {
    const loadingDuration =
      message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed + 500;
    const elements = _createBubbleElements(message, position);
    _messagesEl.appendChild(elements.bubble);
    _messagesEl.appendChild(document.createElement('br'));
    const dimensions = _getDimensions(elements);
    elements.bubble.style.width = '0rem';
    elements.bubble.style.height = dimensions.loading.h;
    elements.message.style.width = dimensions.message.w;
    elements.message.style.height = dimensions.message.h;
    elements.bubble.style.opacity = 1;
    const bubbleOffset =
      elements.bubble.offsetTop + elements.bubble.offsetHeight;
    if (bubbleOffset > _messagesEl.offsetHeight) {
      const scrollMessages = anime({
        targets: _messagesEl,
        scrollTop: bubbleOffset,
        duration: 750,
      });
    }
    const bubbleSize = anime({
      targets: elements.bubble,
      width: ['0rem', dimensions.loading.w],
      marginTop: ['2.5rem', 0],
      marginLeft: ['-2.5rem', 0],
      duration: 800,
      easing: 'easeOutElastic',
    });
    const loadingLoop = anime({
      targets: elements.bubble,
      scale: [1.05, 0.95],
      duration: 1100,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutQuad',
    });
    const dotsStart = anime({
      targets: elements.loading,
      translateX: ['-2rem', '0rem'],
      scale: [0.5, 1],
      duration: 400,
      delay: 25,
      easing: 'easeOutElastic',
    });
    const dotsPulse = anime({
      targets: elements.bubble.querySelectorAll('b'),
      scale: [1, 1.25],
      opacity: [0.5, 1],
      duration: 300,
      loop: true,
      direction: 'alternate',
      delay: function (i) {
        return i * 100 + 50;
      },
    });
    setTimeout(function () {
      loadingLoop.pause();
      dotsPulse.restart({
        opacity: 0,
        scale: 0,
        loop: false,
        direction: 'forwards',
        update: function (a) {
          if (
            a.progress >= 65 &&
            elements.bubble.classList.contains('is-loading')
          ) {
            elements.bubble.classList.remove('is-loading');
            anime({
              targets: elements.message,
              opacity: [0, 1],
              duration: 300,
            });
          }
        },
      });
      bubbleSize.restart({
        scale: 1,
        width: [dimensions.loading.w, dimensions.bubble.w],
        height: [dimensions.loading.h, dimensions.bubble.h],
        marginTop: 0,
        marginLeft: 0,
        begin: function () {
          if (_messageIndex < _messages.length)
            elements.bubble.classList.remove('cornered');
        },
      });
    }, loadingDuration - 50);
  };

  const COOKIE_KEY = 'chrissaid';
  // var COOKIE_VALUE = _getCurrentTimeMessage();

  const checkMessageCookie = function () {
    if (!Cookies.get(COOKIE_KEY)) return false;

    return true;
  };

  const setMessageCookie = function () {
    Cookies.set(COOKIE_KEY, 'hello', { expires: 1 });
  };

  const displaySentMessages = function () {
    const msgFrag = document.createDocumentFragment();
    for (let i = 0; i < _messages.length; i++) {
      const message = document.createElement('div');
      message.className += 'bubble left';
      message.innerHTML = _messages[i];
      if (i === _messages.length - 1) message.className += ' cornered';

      msgFrag.appendChild(message);
      msgFrag.appendChild(document.createElement('br'));
    }

    const msgContainer = document.getElementsByClassName('messages')[0];
    msgContainer.appendChild(msgFrag);

    // Current Time Message
    // var current = document.createElement('div');
    // current.className += 'bubble left cornered';
    // current.innerHTML = Cookies.get(COOKIE_KEY);
    // msgContainer.appendChild(current);
    // msgContainer.appendChild(document.createElement('br'));
  };

  const sendMessages = function () {
    let message = _messages[_messageIndex];
    if (!message) return;
    _prepareMessage(message);
    ++_messageIndex;
    setTimeout(
      sendMessages,
      message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed +
        anime.random(900, 1200),
    );
  };

  return {
    sent: checkMessageCookie,
    displaySent: displaySentMessages,
    setCookie: setMessageCookie,
    send: sendMessages,
  };
})();
