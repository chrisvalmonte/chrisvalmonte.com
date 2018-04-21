document
.querySelector('#skip-link')
.addEventListener('click', function(e) {
	var drawer = document.querySelector('#nav-menu-drawer');
	if(!drawer.classList.contains('open'))
		return;

	toggleNavMenuDrawer(e);
});

document
.querySelector('#nav-menu')
.addEventListener('click', function(e) {
	toggleNavMenuDrawer(e);
});

document
.querySelector('#nav-menu-drawer')
.addEventListener('click', function(e) {
	if (e.target.classList.contains('link'))
		toggleNavMenuDrawer(e);
});

function toggleNavMenuDrawer(event) {
	var drawer = document.querySelector('#nav-menu-drawer');
	drawer.classList.toggle('open');
	drawer.querySelectorAll('.link').forEach(function(link) {
		// Toggle tab index of link
		link.getAttribute('tabindex') === '0'
			? link.setAttribute('tabindex', '-1')
			: link.setAttribute('tabindex', '0');
	});
	drawer.focus();

	// Toggle ARIA expanded role of the navigation menu button
	var navMenuBtn = document.querySelector('#nav-menu');
	navMenuBtn.getAttribute('aria-expanded') === 'false'
		? navMenuBtn.setAttribute('aria-expanded', 'true')
		: navMenuBtn.setAttribute('aria-expanded', 'false');

	document
	.querySelectorAll('.hide-from-drawer')
	.forEach(function(toHide) {
		toHide.classList.toggle('hidden');
	});

	document.querySelector('body').classList.toggle('nav-menu-open');

	event.stopPropagation();
}
