import Reveal from '/dist/reveal.esm.js';

Reveal.initialize({
  customcontrols: {
    controls: [
      { icon: '<i class="fa fa-pen-square"></i>',
        title: 'Toggle chalkboard (B)',
        action: 'RevealChalkboard.toggleChalkboard();'
      },
      { icon: '<i class="fa fa-pen"></i>',
        title: 'Toggle notes canvas (C)',
        action: 'RevealChalkboard.toggleNotesCanvas();'
      },
      { icon: '<i class="fa fa-paragraph"></i><span>+</span>',
        title: "Subir letra",
        action: 'revealPlugins.fontSize.cambiar(1);'
      },
      { icon: '<i class="fa fa-paragraph"></i><span>-</span>',
        title: "Subir letra",
        action: 'revealPlugins.fontSize.cambiar(-1);'
      }

    ]
  },
  chalkboard: {
    eraser: {
      radius: 100
    }
  },
  // ...
  plugins: [ RevealChalkboard, RevealCustomControls, RevealMath.KaTeX ],
  // ...
});
