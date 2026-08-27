const STORAGE_KEY = 'cv_messages_seen_v2';

// The entrance needs the parsed DOM and GSAP, and nothing else. Waiting on
// `load` would also wait on the async analytics bundle, holding the first
// message back by a few hundred milliseconds for bytes it never touches.
const beginEntrance = function () {
  const fab = document.querySelector('.fab > a');
  // Must stay in sync with the device-frame breakpoint in styles.css.
  const isDesktop = window.matchMedia('(min-width: 900px)').matches;
  const showFab = function (delay) {
    gsap.to(fab, { scale: 1, duration: 0.5, delay: delay || 0, ease: 'power1.out' });
  };

  // Paint persisted bubbles before anything moves, so on a return visit the
  // phone rises with the conversation already on its screen.
  const hasSeenBubbles = Messages.init();

  const entrance = gsap.timeline();
  if (isDesktop) {
    entrance.to('.device', { y: 0, duration: 1.2, ease: 'power2.out' });
  }
  entrance.call(function () {
    // The reply button follows the first message. On a return visit that
    // message is already on screen, so it comes in with the phone instead.
    if (hasSeenBubbles) {
      // Nothing is being typed out, so the button has no beat to wait for.
      showFab();
      Messages.start();
    } else {
      // Let the first message settle before the button joins it.
      Messages.start(function () { showFab(0.6); });
    }
  });
};

const Messages = (function () {
  const _messagesEl = document.querySelector('.messages');
  const _typingSpeed = 45;
  const _loadingText = '<b>•</b><b>•</b><b>•</b>';
  let _messageIndex = 0;
  let _onFirstMessage = null;

  const _messages = [
    'Hey 👋',
    'Check out my work',
    '<a href="https://youtu.be/CNY_cEXMnwE" rel="noopener noreferrer" target="_blank">youtu.be/CNY_cEXMnwE</a>',
  ];

  const _getFontSize = function () {
    // parseFloat, not parseInt: the root font-size is fractional at desktop
    // (it scales with viewport height), and truncating it inflates every
    // measurement converted through _pxToRem.
    return parseFloat(getComputedStyle(document.body).getPropertyValue('font-size'));
  };

  // The font size is handed in rather than looked up here. This runs four
  // times for every bubble, and resolving the body's computed style on each
  // conversion re-read a value that cannot change in the middle of a single
  // measurement pass.
  const _pxToRem = function (px, fontSize) {
    return px / fontSize + 'rem';
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
    // The dots are pure animation, so they are kept out of the accessibility
    // tree — otherwise the live region announces "bullet bullet bullet" once
    // for every message that gets typed out.
    loadingEl.setAttribute('aria-hidden', 'true');
    // The text is in the DOM, at full size, well before it is revealed. A live
    // region announces content when it is inserted rather than when it becomes
    // visible, so the message stays hidden through the loading state and is
    // exposed at the moment it fades in.
    messageEl.setAttribute('aria-hidden', 'true');
    messageEl.innerHTML = message;
    // A link inside a hidden subtree is still reachable by Tab, which is its
    // own violation, so any link is taken out of the tab order for as long as
    // the message is hidden.
    messageEl.querySelectorAll('a').forEach(function (link) {
      link.setAttribute('tabindex', '-1');
    });
    loadingEl.innerHTML = _loadingText;
    bubbleEl.appendChild(loadingEl);
    bubbleEl.appendChild(messageEl);
    bubbleEl.style.opacity = '0';

    return { bubble: bubbleEl, message: messageEl, loading: loadingEl };
  };

  // 1px guard against sub-pixel rounding wrapping the text; any more than
  // that shows up as lopsided padding on the right edge of the bubble.
  const _naturalWidth = function (el) {
    return el.getBoundingClientRect().width + 1;
  };

  const _getDimensions = function (elements) {
    // Reads and writes are kept apart on purpose: the bubble has just been put
    // into the document, so the first measurement forces a synchronous layout
    // and every later one forces another if a style lookup has intervened.
    // Taking the root font size and all four geometry values back to back lets
    // the browser lay the page out once per bubble.
    //
    // The font size is cached for this pass only. Nothing between these lines
    // yields to the event loop, so a resize cannot land part-way through and
    // leave half the conversions on a stale value — which is also why it is
    // not hoisted to the module, where seconds pass between bubbles. The
    // measurements are byte-for-byte the ones the per-conversion lookups
    // produced.
    const fontSize = _getFontSize();
    const bubbleWidth = _naturalWidth(elements.bubble);
    const bubbleHeight = elements.bubble.offsetHeight;
    const messageWidth = _naturalWidth(elements.message);
    const messageHeight = elements.message.offsetHeight;

    return {
      loading: { w: '4rem', h: '2.25rem' },
      bubble: {
        w: _pxToRem(bubbleWidth, fontSize),
        h: _pxToRem(bubbleHeight, fontSize),
      },
      message: {
        w: _pxToRem(messageWidth, fontSize),
        h: _pxToRem(messageHeight, fontSize),
      },
    };
  };

  const _prepareMessage = function (message, position) {
    const loadingDuration =
      message.replace(/<(?:.|\n)*?>/gm, '').length * _typingSpeed + 500;
    const elements = _createBubbleElements(message, position);
    _messagesEl.appendChild(elements.bubble);
    // The break is only there to space the bubbles apart, so it is hidden
    // rather than read out as part of the conversation.
    const spacerEl = document.createElement('br');
    spacerEl.setAttribute('aria-hidden', 'true');
    _messagesEl.appendChild(spacerEl);
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
            // Now that the bubble has finished typing, hand the text to the
            // live region. The `is-loading` check above means this runs once
            // per bubble, so the message is announced exactly once.
            elements.message.removeAttribute('aria-hidden');
            elements.message.querySelectorAll('a').forEach(function (link) {
              link.removeAttribute('tabindex');
            });
            gsap.to(elements.message, { opacity: 1, duration: 0.45 });

            if (_onFirstMessage) {
              const notify = _onFirstMessage;
              _onFirstMessage = null;
              notify();
            }

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
    // This runs synchronously on the critical path of a return visit, before
    // anything has painted, so the bubbles are assembled off-document and put
    // in with a single insertion rather than two per message.
    const fragment = document.createDocumentFragment();

    _messages.slice(0, count).forEach(function (message, i) {
      const bubbleEl = document.createElement('div');
      const messageEl = document.createElement('span');

      bubbleEl.classList.add('bubble', 'left');
      if (isComplete && i === count - 1) bubbleEl.classList.add('cornered');
      messageEl.classList.add('message');
      messageEl.innerHTML = message;
      bubbleEl.appendChild(messageEl);

      messageEl.style.opacity = '1';

      fragment.appendChild(bubbleEl);
      // These bubbles are painted before the live region matters and are
      // visible straight away, so the text is left readable and only the
      // spacer is hidden — the same end state the animated path settles into.
      const spacerEl = document.createElement('br');
      spacerEl.setAttribute('aria-hidden', 'true');
      fragment.appendChild(spacerEl);
    });

    _messagesEl.appendChild(fragment);
  };

  // Paint what the visitor has already seen. Split from `start` so the caller
  // can land the bubbles before the entrance animation runs.
  const init = function () {
    const seenCount = Math.min(
      parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10),
      _messages.length
    );

    if (seenCount > 0) _renderSeen(seenCount);

    _messageIndex = seenCount;

    return seenCount > 0;
  };

  // Begin animating whatever is left to say. `onFirstMessage` fires once the
  // first bubble's text is actually revealed, not when its loading pill appears.
  const start = function (onFirstMessage) {
    _onFirstMessage = onFirstMessage || null;
    if (_messageIndex < _messages.length) _sendMessages();
  };

  return { init, start };
})();

// Dispatched from the foot of the file so `Messages` is initialised either way:
// this script is a classic one at the end of <body>, so the document is still
// parsing, but the readyState check keeps it correct if that ever changes.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', beginEntrance);
} else {
  beginEntrance();
}
