// More info about config & dependencies:
// - https://github.com/hakimel/reveal.js#configuration
// - https://github.com/hakimel/reveal.js#dependencies
Reveal.initialize({
  history: true,
  transition: 'linear',

  math: {
    // mathjax: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js',
    config: 'TeX-AMS_HTML-full',
    TeX: {
      Macros: {
        R: '\\mathbb{R}',
        set: [ '\\left\\{#1 \\; ; \\; #2\\right\\}', 2 ]
      }
    }
  },

  //chalkboard: {
	//	theme: "chalkboard",
  //  color: [ 'rgba(30,144,255, 1)', 'rgba(255,255,255,1)' ],
	//},

  dependencies: [
    { src: '../plugin/markdown/marked.js' },
    { src: '../plugin/markdown/markdown.js' },
    { src: '../plugin/notes/notes.js', async: true },
    { src: '../plugin/highlight/highlight.js', async: true },
    { src: '../plugin/math/math.js', async: true },
    { src: '../plugin/chalkboard/chalkboard.js' },
  ],


  keyboard: {
	    66: function()   { RevealChalkboard.toggleChalkboard() },	// toggle chalkboard when 'b' is pressed
	    46: function()   { RevealChalkboard.clear() },	// clear chalkboard when 'DEL' is pressed
	     8: function()   { RevealChalkboard.reset() },	// reset chalkboard data on current slide when 'BACKSPACE' is pressed
	    68: function()   { RevealChalkboard.download() },	// downlad recorded chalkboard drawing when 'd' is pressed
      83: function()   { Reveal.soluciones.cambiar()}, // amosar solucións
      171: function () { Reveal.fontSize.cambiar(1)}, // aumentar tamaño letra
      173: function () { Reveal.fontSize.cambiar(-1)} // diminuir tamaño letra
	},
});

Reveal.soluciones = {
  activado: false,
  cambiar() {
    this.activado = !this.activado;
    var div = document.getElementById("revealdiv");

    if (this.activado) div.classList.add("mostrar-solucion");
    else div.classList.remove("mostrar-solucion");
  }
}

Reveal.fontSize = {
  current: 10,
  cambiar (cantidade) {
    this.current += cantidade;

    var problemas = document.getElementsByClassName("problema");
    for (var i = 0; i < problemas.length; i++) {
      problemas[i].style.fontSize = String (this.current/10) + "em";
    }
  }
}
