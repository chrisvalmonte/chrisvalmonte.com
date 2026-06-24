const STORAGE_KEY = 'cv_messages_seen';

window.onload = function () {
  const fab = document.querySelector('.fab > a');
  gsap.to(fab, { scale: 1, duration: 0.5, ease: 'power1.out' });
  Messages.init();
};

const Messages = (function () {
  const _messagesEl = document.querySelector('.messages');
  const _typingSpeed = 45;
  const _loadingText = '<b>•</b><b>•</b><b>•</b>';
  let _messageIndex = 0;

  const _getCurrentTime = function () {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return hours + minutes * 0.01;
  };

  const _getCurrentTimeMessage = function () {
    const t = _getCurrentTime();
    if (t >= 5 && t < 9) return { action: 'enjoying my morning coffee', goodbye: "What's up?" };
    if (t >= 9 && t < 13) return { action: 'busy programming..', goodbye: 'Talk to you later!' };
    if (t >= 13 && t < 17) return { action: 'in a meeting..', goodbye: 'Talk to you later!' };
    if (t >= 17 && t < 19) return { action: 'having dinner with my family', goodbye: 'Have a good evening!' };
    return { action: "changing my son's diaper..", goodbye: "I'll ttyl, so good night!" };
  };

  const _messages = [
    'Hey 👋',
    "I'm Christopher",
    'I build experiences on the web',
    'Check out some of my work',
    '<a href="https://behance.net/chrisvalmonte" rel="noopener noreferrer" target="_blank">behance.net/chrisvalmonte</a><br><a href="https://github.com/chrisvalmonte" rel="noopener noreferrer" target="_blank">github.com/chrisvalmonte</a>',
    'Currently ' + _getCurrentTimeMessage().action,
    _getCurrentTimeMessage().goodbye,
  ];

  const _getFontSize = function () {
    return parseInt(getComputedStyle(document.body).getPropertyValue('font-size'));
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
    bubbleEl.style.opacity = '0';

    return { bubble: bubbleEl, message: messageEl, loading: loadingEl };
  };

  const _getDimensions = function (elements) {
    return {
      loading: { w: '4rem', h: '2.25rem' },
      bubble: {
        w: _pxToRem(elements.bubble.offsetWidth + 4),
        h: _pxToRem(elements.bubble.offsetHeight),
      },
      message: {
        w: _pxToRem(elements.message.offsetWidth + 4),
        h: _pxToRem(elements.message.offsetHeight),
      },
    };
  };

  const _prepareMessage = function (message, position) {
    const loadingDuration =
      message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed + 500;
    const elements = _createBubbleElements(message, position);
    _messagesEl.appendChild(elements.bubble);
    _messagesEl.appendChild(document.createElement('br'));
    const dimensions = _getDimensions(elements);

    gsap.set(elements.bubble, { width: '0rem', height: dimensions.loading.h, opacity: 1 });
    gsap.set(elements.message, { width: dimensions.message.w, height: dimensions.message.h });

    const bubbleSizeTween = gsap.fromTo(
      elements.bubble,
      { width: '0rem', marginTop: '2.5rem', marginLeft: '-2.5rem' },
      { width: dimensions.loading.w, marginTop: 0, marginLeft: 0, duration: 0.55, ease: 'back.out(1.5)' }
    );

    const loadingLoop = gsap.fromTo(
      elements.bubble,
      { scale: 1.05 },
      { scale: 0.95, duration: 1.1, repeat: -1, yoyo: true, ease: 'power1.inOut' }
    );

    const dots = Array.from(elements.bubble.querySelectorAll('b'));
    gsap.set(dots, { scale: 1, opacity: 0.5 });
    const dotsTweens = dots.map((dot, i) =>
      gsap.to(dot, {
        scale: 1.25,
        opacity: 1,
        duration: 0.3,
        repeat: -1,
        yoyo: true,
        delay: i * 0.1 + 0.05,
      })
    );

    setTimeout(function () {
      loadingLoop.pause();
      dotsTweens.forEach(t => t.kill());

      gsap.to(dots, {
        opacity: 0,
        scale: 0,
        duration: 0.4,
        onUpdate: function () {
          if (this.progress() >= 0.65 && elements.bubble.classList.contains('is-loading')) {
            elements.bubble.classList.remove('is-loading');
            gsap.to(elements.message, { opacity: 1, duration: 0.45 });
            // Persist this bubble as soon as its text is revealed
            const seen = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
            localStorage.setItem(STORAGE_KEY, seen + 1);
          }
        },
      });

      bubbleSizeTween.kill();
      gsap.fromTo(
        elements.bubble,
        { width: dimensions.loading.w, height: dimensions.loading.h },
        {
          scale: 1,
          width: dimensions.bubble.w,
          height: dimensions.bubble.h,
          marginTop: 0,
          marginLeft: 0,
          duration: 0.5,
          ease: 'power3.out',
          onStart: function () {
            if (_messageIndex < _messages.length) elements.bubble.classList.remove('cornered');
          },
        }
      );
    }, loadingDuration - 50);
  };

  const _sendMessages = function () {
    const message = _messages[_messageIndex];
    if (!message) return;
    _prepareMessage(message);
    ++_messageIndex;
    setTimeout(
      _sendMessages,
      message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed +
        gsap.utils.random(1500, 2500)
    );
  };

  // Render already-seen bubbles immediately then continue the animation
  const _renderSeen = function (count) {
    const isComplete = count >= _messages.length;
    const bubbles = _messages.slice(0, count).map(function (message, i) {
      const bubbleEl = document.createElement('div');
      const messageEl = document.createElement('span');

      bubbleEl.classList.add('bubble', 'left');
      if (isComplete && i === count - 1) bubbleEl.classList.add('cornered');
      messageEl.classList.add('message');
      messageEl.innerHTML = message;
      bubbleEl.appendChild(messageEl);

      bubbleEl.style.opacity = '0';
      messageEl.style.opacity = '1';

      _messagesEl.appendChild(bubbleEl);
      _messagesEl.appendChild(document.createElement('br'));

      return bubbleEl;
    });

    gsap.to(bubbles, { opacity: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out' });
  };

  const init = function () {
    const seenCount = Math.min(
      parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10),
      _messages.length
    );

    if (seenCount > 0) _renderSeen(seenCount);

    if (seenCount < _messages.length) {
      _messageIndex = seenCount;
      _sendMessages();
    }
  };

  return { init };
})();
