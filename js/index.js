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
	document.querySelector('#nav-menu-drawer').classList.toggle('open');
	document.querySelector('body').classList.toggle('nav-menu-open');
	event.stopPropagation();
}
