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
		toggleTabIndex(link);
	});
	drawer.focus();

	document
	.querySelectorAll('.hide-from-drawer')
	.forEach(function(toHide) {
		toHide.classList.toggle('hidden');
	});

	document.querySelector('body').classList.toggle('nav-menu-open');

	event.stopPropagation();
}

function toggleTabIndex(el) {
	el.getAttribute('tabindex') === '0'
		? el.setAttribute('tabindex', '-1')
		: el.setAttribute('tabindex', '0');
}
