

var link = document.createElement( 'link' );
link.rel = 'stylesheet';
link.type = 'text/css';
link.href = window.location.search.match( /print-pdf/gi ) ? '../css/print/pdf.css' : '../css/print/paper.css';
document.getElementsByTagName( 'head' )[0].appendChild( link );

if (window.location.search.match( /print-pdf/gi )) {
  var link = document.createElement( 'link' );
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = '../css/theme/white.css';
  document.getElementsByTagName( 'head' )[0].appendChild( link );
}
