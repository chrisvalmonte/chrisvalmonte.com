var body = document.querySelector('body');
var menu = document.getElementById('nav-menu');
var drawer = document.getElementById('nav-menu-drawer');
var drawerLinks = drawer.querySelectorAll('a');

menu.addEventListener('click', function(e) {
	drawer.classList.toggle('open');
	body.classList.toggle('nav-menu-open');
	e.stopPropagation();
});

for (var i = 0; i < drawerLinks.length; ++i) {
	drawerLinks[i].addEventListener('click', function(e) {
		drawer.classList.toggle('open');
		body.classList.toggle('nav-menu-open');
		e.stopPropagation();
	});
}
