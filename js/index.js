document
.querySelector('#nav-menu')
.addEventListener('click', function(e) {
	toggleNavMenu(e);
});

document
.querySelector('#nav-menu-drawer')
.addEventListener('click', function(e) {
	if (e.target.classList.contains('link'))
		toggleNavMenu(e);
});

function toggleNavMenu(event) {
	var drawer = document.querySelector('#nav-menu-drawer');
	drawer.classList.toggle('open');
	drawer.focus();
	document.querySelector('body').classList.toggle('nav-menu-open');
	event.stopPropagation();
}
