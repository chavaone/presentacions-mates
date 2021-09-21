#!/usr/bin/env python

import sys
from bs4 import BeautifulSoup

def help():
    pass


def apartado2latex (apartado):
    try:
        solucion = apartado.find("span", class_="solucion").extract()
    except:
        solucion = ""
    texto = apartado.getText().strip()
    texto = texto.replace("\[", "$").replace("\]", "$")
    return "\item " + texto

def html2latex (problem):
    enunciado_tag = problem.find("p")
    enunciado_tag.find("span", class_="numero").extract()
    enunciado_txt = enunciado_tag.getText().replace("\[", "$").replace("\]", "$")
    try:
        apartados = [apartado2latex(apartado) for apartado in problem.find("ol", class_="problema__apartados").find_all("li")]
    except:
        apartados = []

    return "\\Exercicio " + enunciado_txt + "\n\\begin{enumerate}[topsep=0pt]\n " + "\n".join(apartados) + "\n\\end{enumerate}\n\n"


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
