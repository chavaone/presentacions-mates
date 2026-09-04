import Reveal from "/dist/reveal.esm.js";
import createRevealLivePhoto from "/plugin/live-photo/live-photo.js";

/*
 * ============================================================
 * Reveal Live Photo
 * ============================================================
 *
 * Cambia signal.TU_DOMINIO por el dominio que vayamos a
 * configurar para el servidor Docker.
 */

const RevealLivePhoto = createRevealLivePhoto({
  signalingUrl: "wss://signal.aquelando.info/ws",

  qrEndpoint: "https://signal.aquelando.info/api/qr",

  // La interfaz móvil está alojada junto con Reveal/GitHub Pages.
  mobileUrl: `${window.location.origin}/mobile/live-photo/`,

  // Tecla para abrir/cerrar el visor.
  key: "P",

  // Mostrar automáticamente una foto cuando llega.
  autoShow: true,

  // Número máximo de fotografías conservadas en memoria.
  maxPhotos: 10,
});

/*
 * ============================================================
 * Reveal
 * ============================================================
 */

Reveal.initialize({
  /*
   * ----------------------------------------------------------
   * Custom Controls
   * ----------------------------------------------------------
   */

  customcontrols: {
    controls: [
      {
        icon: '<i class="fa fa-pen-square"></i>',
        title: "Toggle chalkboard (B)",
        action: "RevealChalkboard.toggleChalkboard();",
      },

      {
        icon: '<i class="fa fa-pen"></i>',
        title: "Toggle notes canvas (C)",
        action: "RevealChalkboard.toggleNotesCanvas();",
      },

      {
        icon: '<i class="fa fa-paragraph"></i><span>+</span>',
        title: "Subir letra",
        action: "revealPlugins.fontSize.cambiar(1);",
      },

      {
        icon: '<i class="fa fa-paragraph"></i><span>-</span>',
        title: "Bajar letra",
        action: "revealPlugins.fontSize.cambiar(-1);",
      },

      /*
       * Fotos de libretas en directo
       */
      {
        icon: '<i class="fa fa-camera"></i>',
        title: "Fotos en directo (P)",
        action:
          "window.dispatchEvent(new CustomEvent('reveal-live-photo:toggle'));",
      },
    ],
  },

  /*
   * ----------------------------------------------------------
   * Chalkboard
   * ----------------------------------------------------------
   */

  chalkboard: {
    eraser: {
      radius: 100,
    },
  },

  /*
   * ----------------------------------------------------------
   * KaTeX
   * ----------------------------------------------------------
   */

  katex: {
    version: "latest",

    delimiters: [
      {
        left: "$$",
        right: "$$",
        display: true,
      },

      {
        left: "$",
        right: "$",
        display: false,
      },

      {
        left: "\\(",
        right: "\\)",
        display: true,
      },

      {
        left: "\\[",
        right: "\\]",
        display: true,
      },
    ],

    ignoredTags: ["script", "noscript", "style", "textarea", "pre"],
  },

  /*
   * ==========================================================
   * Aquí puedes mantener el resto de las opciones que ya
   * tengas configuradas en tu config.esm.js.
   * ==========================================================
   *
   * Por ejemplo:
   *
   * hash: true,
   * controls: true,
   * progress: true,
   * center: true,
   * transition: "slide",
   *
   */

  /*
   * ----------------------------------------------------------
   * Plugins
   * ----------------------------------------------------------
   */

  plugins: [
    RevealChalkboard,
    RevealCustomControls,
    RevealMath.KaTeX,
    RevealLivePhoto,
  ],
});

/*
 * Dejamos Reveal accesible globalmente.
 *
 * Esto puede resultar útil para tus plugins personalizados,
 * la consola y otros scripts clásicos que no sean módulos ES.
 */

window.Reveal = Reveal;
