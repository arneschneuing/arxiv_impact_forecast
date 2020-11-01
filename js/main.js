// Store checkbox state
var checkboxes = {}


function makeClassList(archive, checkbox_state) {
    // Create the list element
    var list = document.createElement('div');
    list.setAttribute("class", "list-group");

    for (var category in archive) {
        // Create input
        var inpt = document.createElement('input');
        inpt.setAttribute("type", "checkbox");
        inpt.setAttribute("class", "custom-control-input");
        inpt.setAttribute("id", "check" + archive[category]);
        inpt.checked = checkbox_state[archive[category]];
        inpt.setAttribute(
            "onclick", 
            `processCheckboxChange('${archive[category]}')`);

        // Create label
        var label = document.createElement('label');
        label.setAttribute("class", "custom-control-label");
        label.setAttribute("for", "check" + archive[category]);
        label.appendChild(document.createTextNode(category));

        // Create division
        var div = document.createElement('div');
        div.setAttribute("class", "custom-control custom-checkbox");
        div.appendChild(inpt);
        div.appendChild(label);

        // Create the list item:
        var item = document.createElement('li');
        item.setAttribute("class", "list-group-item");
        item.appendChild(div);

        // Add it to the list:
        list.appendChild(item);
    }

    // Finally, return the constructed list:
    return list;
}


function makeCategoryList(category_spec, checkbox_state) {
    archive_list = Object.keys(category_spec);

    // Create the list element
    var list = document.getElementById('category_list');

    for (var i = 0; i < archive_list.length; i++) {
        // Create button
        var button = document.createElement('button');
        button.setAttribute("class", "btn btn-secondary dropdown-toggle bg-dark");
        button.setAttribute("id", "toggleButton" + i);
        button.setAttribute("data-toggle", "collapse");
        button.setAttribute("data-target", "#collapse" + i);
        button.setAttribute("aria-controls", "collapse" + i);
        button.appendChild(document.createTextNode(archive_list[i]));

        // Add content
        var content = document.createElement('div');
        content.setAttribute("class", "collapse");
        content.setAttribute("id", "collapse" + i);
        content.setAttribute("aria-labelledby", "toggleButton" + i);
        content.appendChild(
            makeClassList(category_spec[archive_list[i]], checkbox_state)
        );

        // Create dropdown menu
        var dropdown = document.createElement('div');
        dropdown.setAttribute("class", "dropdown");
        dropdown.appendChild(button);
        dropdown.appendChild(content);

        // Add it to the list:
        list.appendChild(dropdown);
    }

    // Finally, return the constructed list:
    return list;
}


function setCookie(name, value, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}
  
function getCookie(name) {
    var cookie = document.cookie;
    if (cookie.length == 0) {return "";}
    else {
        return cookie.split('; ').find(row => row.startsWith(name))
        .split('=')[1];
    }
}

function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function saveCheckboxState(exdays = 365) {
    setCookie('checkboxState', JSON.stringify(checkboxes), exdays);
}

function loadCheckboxState(category_spec) {
    var checkbox_state = {}
    var cb_string = getCookie('checkboxState');

    if (cb_string == "") {
        console.log("No checkbox state found. Creating new object...");
        // Initialize new checkbox state with 'false' values
        for (var archive in category_spec) {
            var tmp = category_spec[archive];
            for (var category in tmp) {
                checkbox_state[category_spec[archive][category]] = false
            }
        }
    } 
    else {
        console.log("Checkbox state found.");
        var cb_state_tmp = JSON.parse(cb_string);

        // update checkbox state keys if necessary 
        // outdated keys are not copied
        for (var archive in category_spec) {
            for (var category in category_spec[archive]) {
                key = category_spec[archive][category];
                if (key in cb_state_tmp) {
                    checkbox_state[key] = cb_state_tmp[key];
                }
                else {
                    // add new key
                    checkbox_state[key] = false
                }
            }
        }
    }
    return checkbox_state
}


function processCheckboxChange(key) {
    checkboxes[key] = !checkboxes[key];

    // Save updated version
    saveCheckboxState();

    // Update paper list
    getPapers(checkboxes);
}


function getCategories() {
    return fetch('/categories')
    .then(response => response.json())
    .then(category_specifiers => {
        checkbox_state = loadCheckboxState(category_specifiers);
        makeCategoryList(category_specifiers, checkbox_state);
        checkboxes = checkbox_state;  // update global variable
        return checkbox_state;
    })
    .catch(error => {
        console.error('Error:', error);
        alert("An error occured during communication with the backend. " + 
        "Please make sure that backend.py is up and running.");
    });
}


function makePaperList(array) {
    // Create new group of papers
    var papers = document.createElement('div');

    for (var i = 0; i < array.length; i++) {
        // Create card header
        var specifier = document.createElement('span');
        specifier.setAttribute("class", "float-right");
        specifier.appendChild(
            document.createTextNode(`[${array[i]['category']}]`)
        );
        
        var score = document.createElement('b');
        score.setAttribute("class", "float-left");
        score.appendChild(
            document.createTextNode(`Score: ${array[i]['score']}`)
        );

        var header = document.createElement('div');
        header.setAttribute("class", "card-header");
        header.appendChild(specifier);
        header.appendChild(score);
        header.appendChild(document.createElement('clearfix'));

        // create title
        var title = document.createElement('h4');
        title.setAttribute("class", "card-title");
        title.appendChild(document.createTextNode(array[i]['title']));

        // create subtitle
        var authors = document.createElement('h6');
        authors.setAttribute("class", "card-subtitle mb-2 text-muted");
        author_list = array[i]['authors']
        author_string = ""
        for (j = 0; j < author_list.length; j++) { 
            author_string += author_list[j];
            if (j < author_list.length - 1) {
                author_string += ", "
            }
        } 
        authors.appendChild(document.createTextNode(author_string));

        // create text
        var abstract = document.createElement('p');
        abstract.setAttribute("class", "card-text");
        abstract.appendChild(document.createTextNode(array[i]['abstract']));

        // create card body (title, subtitle and text)
        var body = document.createElement('div');
        body.setAttribute("class", "card-body");
        body.appendChild(title);
        body.appendChild(authors);
        body.appendChild(abstract);

        // create hyperlink
        var link = document.createElement('a');
        link.setAttribute("class", "card-link");
        link.setAttribute("href", array[i]['hyperlink']);
        link.appendChild(document.createTextNode("Read more"));

        // create card footer
        var footer = document.createElement('div');
        footer.setAttribute("class", "card-footer");
        footer.appendChild(link);

        // create card
        var paper_card = document.createElement('div');
        paper_card.setAttribute("class", "card");
        paper_card.appendChild(header);
        paper_card.appendChild(body);
        paper_card.appendChild(footer);

        var col = document.createElement('div');
        col.setAttribute("class", "col-sm mb-5");
        col.appendChild(paper_card);

        // add to papers group
        papers.appendChild(col);
    }

    return papers;
}


function makeSpinner(container) {

    // create spinner
    var spinner = document.createElement('div');
    spinner.setAttribute("class", "spinner-grow");
    spinner.setAttribute("role", "status");

    // create container for placement
    var box = document.createElement('div');
    box.setAttribute("class", "text-center mb-5");
    box.appendChild(spinner);

    // add to HTML page
    container.prepend(box);
}


function getPapers(checkbox_state) {
    // Get paper cards container
    var container = document.getElementById('paper_cards');
    makeSpinner(container);

    var params = {
        'checkbox_state': checkbox_state,
        'maxitem': document.getElementById('maxPaperInput').value
    };
    
    fetch('/papers', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params) // payload
    })
    .then(response => response.json())
    .then(data => {
        papers = makePaperList(data);

        // add to HTML page
        container.innerHTML = '';
        container.appendChild(papers);
        
        // Run MathJax
        MathJax.typeset()
    })
    .catch(error => {
        console.error('Error:', error);
    });
}


function updateSliderText(val) {
    var sliderText = document.getElementById('sliderText'); 
    sliderText.innerHTML = val;
}


// MAIN
window.onload = function () {
    getCategories()
    .then(checkboxes => {getPapers(checkboxes);});

    updateSliderText(document.getElementById('maxPaperInput').value);
}


