var revealPlugins = {}

revealPlugins.fontSize = {
  current: 20,
  cambiar (cantidade) {
    this.current += cantidade;

    var folla = document.getElementById("tamanho_letra");

    if (! folla) {
      folla = document.createElement("style");
      folla.id = "tamanho_letra";
      document.head.appendChild(folla);
      folla = document.getElementById("tamanho_letra");
    }
    
    folla.textContent = ".reveal section {font-size: " + this.current + "pt !important; }"

  }
}
