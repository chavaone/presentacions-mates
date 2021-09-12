#!/usr/bin/env python


import sys
from bs4 import BeautifulSoup


def help():
    pass

def html2latex (problem):
    

def main():

    if len(sys.argv) != 2:
        help()

    htmlTxt = ""


    with open(argv[1]) as file:
        htmlTxt = file.read()

    soup = BeautifulSoup(htmlTxt, 'html.parser')
    problems_html = soup.find_all(class_="problema")
    problems_latex = [html2latex(problem) for problem in problems_html]

    print("\n".join(problems_latex))

if __name__ == '__main__':
    main()
