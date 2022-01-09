#!/usr/bin/env python

import sys
from bs4 import BeautifulSoup

def help():
    pass

def tabla2latex (tabla):
    return ""

def apartado2latex (apartado):
    try:
        solucion = apartado.find("span", class_="solucion").extract()
    except:
        solucion = ""
    try:
        numero = apartado.find("span", class_="numero").extract()
    except:
        pass
    texto = apartado.getText().strip()
    texto = texto.replace("\[", "$").replace("\]", "$")
    return "\item \\textbf{[C]} " + texto

def html2latex (problem):
    try:
        enunciado_tag = problem.find("p")
        enunciado_tag.find("span", class_="numero").extract()
        enunciado_txt = enunciado_tag.getText().replace("\[", "$").replace("\]", "$")
        enunciado_txt = enunciado_txt.replace("%", "\%")
    except:
        enunciado_txt = ""

    try:
        tabla = problem.find("table").extract()
        tabla_txt = tabla2latex(tabla)
    except:
        tabla_txt = ""

    try:
        apartados = [apartado2latex(apartado) for apartado in problem.find(class_="problema__apartados").find_all("li")]
    except:
        apartados = []

    try:
        quote = problema.find("q").extract()
        quote_txt = quote.getText()
    except:
        quote_txt = ""

    ret = "\\Exercicio " + enunciado_txt + "\n"

    if quote_txt:
        ret += "\\begin{quote}\n" + quote_txt + "\n\\end{quote}\n"

    if tabla_txt:
        ret += tabla_txt + "\n"

    if apartados:
        ret += "\n\\begin{enumerate}[topsep=0pt]\n" + "\n\t".join(apartados) + "\n\\end{enumerate}\n\n"

    return ret


def main():

    if len(sys.argv) != 2:
        help()
        sys.exit()

    htmlTxt = ""


    with open(sys.argv[1]) as file:
        htmlTxt = file.read()

    soup = BeautifulSoup(htmlTxt, 'html.parser')
    problems_html = soup.find_all(class_="problema")
    problems_latex = [html2latex(problem) for problem in problems_html]

    print("\n".join(problems_latex))

if __name__ == '__main__':
    main()
