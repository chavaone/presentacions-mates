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

  chalkboard: {
		theme: "whiteboard",
	},

  dependencies: [
    { src: '../plugin/markdown/marked.js' },
    { src: '../plugin/markdown/markdown.js' },
    { src: '../plugin/notes/notes.js', async: true },
    { src: '../plugin/highlight/highlight.js', async: true },
    { src: '../plugin/math/math.js', async: true },
    { src: '../plugin/chalkboard/chalkboard.js' },
  ],
  
  keyboard: {
	    66: function() { RevealChalkboard.toggleChalkboard() },	// toggle chalkboard when 'b' is pressed
	    46: function() { RevealChalkboard.clear() },	// clear chalkboard when 'DEL' is pressed
	     8: function() { RevealChalkboard.reset() },	// reset chalkboard data on current slide when 'BACKSPACE' is pressed
	    68: function() { RevealChalkboard.download() },	// downlad recorded chalkboard drawing when 'd' is pressed
	},
});
