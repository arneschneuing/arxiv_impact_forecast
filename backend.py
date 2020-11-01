import os
import re
import json
import urllib
import html

from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, render_template

HOST = '127.0.0.1'
PORT = 5000


# Initialize Flask application
main_dir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__, static_folder=main_dir, template_folder=main_dir)


def get_name_from_specifier(specifier):
    """
    Find the whole name of a subject class given its specifier 
    :param specifier: Subject class specifier
    """
    url = 'http://export.arxiv.org/rss/' + specifier

    # send request
    response = urllib.request.urlopen(url).read().decode('utf-8')
    response = html.unescape(response)
    # response = response.replace('&lt;', '<').replace('&gt;', '>')

    # parse the response
    soup = BeautifulSoup(response, 'html.parser')

    text = soup.find('dc:subject').text

    match = re.search(r'-- (.*)', text)
    if match:
        class_name = match.group(1) + f' [{specifier}]'
    else:
        class_name = text + f' [{specifier}]'

    return class_name


def category_scraper():
    """
    Retrieve category and subject data from arXiv using the provided Open 
    Archives Initiative Protocol for Metadata Harvesting (OAI-PMH) interface and 
    invalid RSS news feed requests.
    The result is saved to 'categories.txt'.
    """
    # General arXiv notation (see: https://arxiv.org/help/arxiv_identifier):
    # Group (e.g. Mathematics) -> Archive (e.g. math) 
    # -> Subject class (e.g. Number Theory, NT)
    # Note that subject classes do not exist for some of the older archives in 
    # the Physics group!

    ### Get archive first ###
    # request data
    url = 'http://export.arxiv.org/oai2?verb=ListSets'
    response = urllib.request.urlopen(url).read()

    # parse the response
    soup = BeautifulSoup(response, 'html.parser')

    archives = {}
    for item in soup.find_all('set'):
        spec = item.find('setspec').text
        spec = re.sub(r'^.*?:', repl='', string=spec)  # remove group identifier
        # ensure that each specifier is unique
        if spec not in archives.values():
            name = item.find('setname').text
            archives[name] = spec
        
    ### Get subject classes for each archive ###
    category_specifiers = {}  # local variable
    for name in archives:
        spec = archives[name]

        # send invalid RSS news feed request
        url = 'http://export.arxiv.org/rss/' + f'{spec}.invalid'
        response = urllib.request.urlopen(url).read().decode()

        # extract important part
        classes = re.search(r'are (.*).', response).group(1).split(', ')

        category_specifiers[name] = {}
        for item in classes:
            if not item:
                # no subject class exists
                class_name = get_name_from_specifier(spec)
                category_specifiers[name][class_name] = spec
            else:
                class_name = get_name_from_specifier(f"{spec}.{item}")
                category_specifiers[name][class_name] = f"{spec}.{item}"

    # save and return the results
    with open('categories.txt', 'w') as f:
        json.dump(category_specifiers, f)

    return category_specifiers


@app.route("/categories")
def get_categories():
    """
    Retrieve category and subject data from arXiv using the provided Open 
    Archives Initiative Protocol for Metadata Harvesting (OAI-PMH) interface
    """
    # Load category dict
    try:
        with open('categories.txt') as json_file:
            category_specifiers = json.load(json_file)

    except FileNotFoundError:
        print("Warning: 'category.txt' could not be found.")
        print("Running 'category_scraper()' to retrieve available arXiv categories...")
        category_specifiers = category_scraper()

    return jsonify(category_specifiers)


def get_papers_from_category(category_spec, maxitem):
    base_url = 'http://export.arxiv.org/rss/'

    # send request
    response = urllib.request.urlopen(base_url + category_spec).read().decode('utf-8')
    response = html.unescape(response)

    # parse the response
    soup = BeautifulSoup(response, 'html.parser')

    papers = []
    for item in soup.find_all('item')[:maxitem]:
        title = item.find('title').text
        # remove text within parentheses
        title = re.sub(r'\([^)]*\)', repl='', string=title)[:-1]
        link = item.attrs['rdf:about']
        abstract = item.find('description').find('p').text

        # collect authors
        authors = [a.text for a in item.find('dc:creator').find_all('a')]

        # get arxiv ID
        arxiv_id = re.findall(r'\d+.\d+', link)[0]

        # append new paper dict
        papers.append({
            'title': title,
            'authors': authors,
            'hyperlink': link,
            'abstract': abstract,
            'category': category_spec,
            'score': score_paper(arxiv_id)
        })

    return papers


@app.route("/papers", methods=['POST'])
def parse_papers():
    assert request.method == 'POST'

    params = request.get_json()
    checkbox_state = params['checkbox_state']
    maxitem = int(params['maxitem'])

    papers = []
    for category_specifier in checkbox_state:
        if checkbox_state[category_specifier]:
            papers += get_papers_from_category(category_specifier, maxitem)

    # Sort the list according to the scores
    papers = sorted(papers, key=lambda paper: paper['score'], reverse=True)

    return jsonify(papers)


# import random
# def score_paper(*args, **kwargs):
#     author_list = args[0]
#     return random.randint(0, 100)

def score_paper(arxiv_id):
    """
    Sum up the 'influentialCitationCount' (Semantic Scholar) from each author
    """
    if arxiv_id in paper_scores:
        return paper_scores[arxiv_id]

    # request data
    base_url = 'https://api.semanticscholar.org/v1/paper/arXiv:'
    try:
        response = urllib.request.urlopen(base_url + arxiv_id).read().decode()
    except urllib.error.HTTPError:
        return -1

    author_ids = [a["authorId"] for a in json.loads(response)["authors"]]
    citations = [semanticscholar_author_citation(aid) for aid in author_ids]
    score = sum(citations)

    # store the score for later retrieval
    paper_scores[arxiv_id] = score
    return score


def semanticscholar_author_citation(author_id):
    if author_id is None:
        return 0

    # request data
    base_url = 'https://api.semanticscholar.org/v1/author/'
    response = urllib.request.urlopen(base_url + author_id).read().decode()
    author_dict = json.loads(response)
    return author_dict["influentialCitationCount"]


@app.route('/') 
def home(): 
    return render_template("index.html")


if __name__ == "__main__":
    # remember already processed papers to accelerate the application
    paper_scores = {}

    # start the server
    app.run(host=HOST, port=PORT, debug=True)
