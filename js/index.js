document
.querySelector('#skip-link')
.addEventListener('click', function(e) {
	if(!document.querySelector('#nav-menu-drawer').getAttribute('aria-expanded'))
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

	drawer.querySelectorAll('.link').forEach(function(link) {
		// Toggle tab index of link
		link.getAttribute('tabindex') === '0'
			? link.setAttribute('tabindex', '-1')
			: link.setAttribute('tabindex', '0');
	});

	// Toggle ARIA expanded role of the navigation menu drawer
	drawer.getAttribute('aria-expanded') === 'false'
		? drawer.setAttribute('aria-expanded', 'true')
		: drawer.setAttribute('aria-expanded', 'false');

	drawer.focus();

	document
	.querySelectorAll('.hide-from-drawer')
	.forEach(function(toHide) {
		toHide.classList.toggle('hidden');
	});

	document.querySelector('body').classList.toggle('nav-menu-open');

	event.stopPropagation();
}
